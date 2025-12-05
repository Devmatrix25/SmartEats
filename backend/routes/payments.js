import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { validationResult, body, param } from 'express-validator';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import User from '../models/User.js';
import Restaurant from '../models/Restaurant.js';
import Payment from '../models/Payment.js';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// Create payment intent
router.post('/create-payment-intent', authenticate, [
    body('amount').isFloat({ min: 1 }),
    body('currency').optional().isIn(['INR', 'USD']).default('INR')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { amount, currency } = req.body;

        // REAL Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: currency.toLowerCase(),
            metadata: { userId: req.user._id.toString() }
        });

        // Store payment
        await Payment.create({
            user: req.user._id,
            paymentIntentId: paymentIntent.id,
            amount,
            currency,
            status: 'pending',
        });

        return res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });

    } catch (error) {
        console.error("Stripe create-payment-intent error", error);
        return res.status(500).json({ message: "Could not create payment intent" });
    }
});

// Confirm payment
// Confirm payment
router.post('/confirm', authenticate, async (req, res) => {
    try {
        const { paymentIntentId, items, restaurantId, deliveryAddress, paymentMethod } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({ message: "PaymentIntent ID missing" });
        }

        // Verify payment with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (!paymentIntent || paymentIntent.status !== "succeeded") {
            return res.status(400).json({ message: "Payment not completed" });
        }

        // Load restaurant
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

        // Calculate totals
        const orderTotal = (items || []).reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.quantity || 0)), 0);
        const deliveryFee = Number(restaurant.deliveryInfo?.deliveryFee || 30);
        const tax = Number((orderTotal * 0.05).toFixed(2));
        const finalAmount = Number((orderTotal + deliveryFee + tax).toFixed(2));

        // Format deliveryAddress to Order model shape
        const formattedAddress = {
            street: deliveryAddress?.address || deliveryAddress?.street || "",
            city: deliveryAddress?.city || "",
            state: deliveryAddress?.state || "",
            zipCode: deliveryAddress?.pincode || deliveryAddress?.zipCode || ""
        };

        // Build order items (include total)
        const orderItems = (items || []).map(it => ({
            menuItem: it.menuItemId || it.menuItem || null,
            name: it.name || "",
            price: Number(it.price || 0),
            quantity: Number(it.quantity || 0),
            specialInstructions: it.specialInstructions || "",
            total: Number((Number(it.price || 0) * Number(it.quantity || 0)).toFixed(2))
        }));

        // Helper to generate orderId matching your model's style:
        const generateOrderId = () => {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2, 6);
            return (`SE${timestamp}${random}`).toUpperCase();
        };

        // Ensure unique-ish orderId (very low collision chance)
        const newOrderId = generateOrderId();

        // Create order (explicitly set required fields like orderId)
        const order = await Order.create({
            orderId: newOrderId,          // required by schema
            customer: req.user._id,
            restaurant: restaurantId,

            items: orderItems,

            orderTotal: orderTotal,
            deliveryFee: deliveryFee,
            tax: tax,
            discount: 0,
            finalAmount: finalAmount,

            deliveryAddress: formattedAddress,

            status: "pending",
            preparationTime: restaurant.deliveryInfo?.deliveryTime || 20,
            deliveryTime: 30,

            payment: {
                method: paymentMethod || 'card',
                status: 'completed',
                paymentIntentId: paymentIntentId,
                transactionId: paymentIntent.charges?.data?.[0]?.id || undefined
            },

            specialInstructions: ""
        });

        // Update Payment record to link to order
        await Payment.findOneAndUpdate(
            { paymentIntentId },
            { status: "succeeded", order: order._id, paidAt: new Date() },
            { new: true }
        );

        // Safe socket emit
        try {
            const io = req.app.get("io");
            if (io) {
                io.to(`restaurant:${restaurantId}`).emit("order:new", {
                    orderId: order._id,
                    order: order.toObject()
                });
            } else {
                console.warn("Socket.io (io) not available - skipped emit");
            }
        } catch (emitErr) {
            console.warn("Socket emit error:", emitErr.message);
        }

        return res.json({
            message: "Payment confirmed & order created",
            order
        });

    } catch (error) {
        console.error("Payment confirm error:", error);
        // If duplicate key / validation happens again, print details for debugging
        return res.status(500).json({ message: "Payment confirmation failed" });
    }
});

// Handle payment webhooks (for production)
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];
        // In production, verify webhook signature
        
        const event = req.body;
        
        switch (event.type) {
            case 'payment_intent.succeeded':
                handlePaymentSuccess(event.data.object);
                break;
            case 'payment_intent.payment_failed':
                handlePaymentFailure(event.data.object);
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).json({ message: 'Webhook error' });
    }
});

// Get payment methods
router.get('/methods', authenticate, async (req, res) => {
    try {
        // In production, fetch from payment gateway
        // For demo, return static payment methods
        const paymentMethods = [
            {
                id: 'card',
                name: 'Credit/Debit Card',
                icon: '💳',
                description: 'Pay with Visa, MasterCard, or RuPay'
            },
            {
                id: 'upi',
                name: 'UPI',
                icon: '📱',
                description: 'Pay using UPI apps'
            },
            {
                id: 'netbanking',
                name: 'Net Banking',
                icon: '🏦',
                description: 'Pay using net banking'
            },
            {
                id: 'wallet',
                name: 'Wallet',
                icon: '👛',
                description: 'Pay using SmartEats Wallet'
            },
            {
                id: 'cod',
                name: 'Cash on Delivery',
                icon: '💵',
                description: 'Pay when you receive your order'
            }
        ];

        res.json({ paymentMethods });
    } catch (error) {
        console.error('Get payment methods error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add money to wallet
router.post('/wallet/topup', authenticate, [
    body('amount').isFloat({ min: 10, max: 10000 }),
    body('paymentMethod').isIn(['card', 'upi', 'netbanking'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { amount, paymentMethod } = req.body;

        // Create payment intent for wallet topup
        const paymentIntent = {
            id: `pi_${Math.random().toString(36).substr(2, 9)}`,
            client_secret: `pi_${Math.random().toString(36).substr(2, 9)}_secret_${Math.random().toString(36).substr(2, 9)}`,
            amount: Math.round(amount * 100),
            currency: 'inr'
        };

        // Store wallet transaction
        const walletTransaction = new Payment({
            user: req.user._id,
            type: 'wallet_topup',
            amount,
            currency: 'INR',
            paymentMethod,
            paymentIntentId: paymentIntent.id,
            status: 'pending'
        });

        await walletTransaction.save();

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount,
            currency: 'INR'
        });
    } catch (error) {
        console.error('Wallet topup error:', error);
        res.status(500).json({ message: 'Wallet topup failed' });
    }
});

// Confirm wallet topup
router.post('/wallet/confirm', authenticate, [
    body('paymentIntentId').notEmpty(),
    body('amount').isFloat({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { paymentIntentId, amount } = req.body;

        // Verify payment (in production, verify with payment gateway)
        const isPaymentSuccessful = Math.random() > 0.1;

        if (!isPaymentSuccessful) {
            return res.status(400).json({ message: 'Payment failed' });
        }

        // Update user wallet balance
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $inc: { walletBalance: amount } },
            { new: true }
        );

        // Update payment record
        await Payment.findOneAndUpdate(
            { paymentIntentId },
            {
                status: 'succeeded',
                paidAt: new Date()
            }
        );

        res.json({
            message: 'Wallet topup successful',
            newBalance: user.walletBalance,
            amountAdded: amount
        });
    } catch (error) {
        console.error('Confirm wallet topup error:', error);
        res.status(500).json({ message: 'Wallet topup confirmation failed' });
    }
});

// Get wallet balance and transactions
router.get('/wallet', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const user = await User.findById(req.user._id).select('walletBalance');
        
        const transactions = await Payment.find({
            user: req.user._id,
            $or: [
                { type: 'wallet_topup' },
                { order: { $exists: true } }
            ]
        })
        .populate('order', 'orderNumber totalAmount')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

        const total = await Payment.countDocuments({
            user: req.user._id,
            $or: [
                { type: 'wallet_topup' },
                { order: { $exists: true } }
            ]
        });

        res.json({
            balance: user.walletBalance,
            transactions,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Get wallet error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Refund payment
router.post('/refund', authenticate, [
    body('orderId').isMongoId(),
    body('reason').notEmpty().trim().escape()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { orderId, reason } = req.body;

        const order = await Order.findOne({
            _id: orderId,
            user: req.user._id
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status === 'delivered') {
            return res.status(400).json({ 
                message: 'Cannot refund delivered order. Please contact support.' 
            });
        }

        if (order.refundStatus) {
            return res.status(400).json({ 
                message: `Refund already ${order.refundStatus}` 
            });
        }

        // Initiate refund
        order.refundStatus = 'requested';
        order.refundReason = reason;
        order.refundRequestedAt = new Date();
        await order.save();

        // In production, initiate refund with payment gateway
        // For demo, we'll simulate refund processing

        res.json({
            message: 'Refund requested successfully',
            refundId: `ref_${Math.random().toString(36).substr(2, 9)}`,
            status: 'requested'
        });
    } catch (error) {
        console.error('Refund request error:', error);
        res.status(500).json({ message: 'Refund request failed' });
    }
});

// Helper functions for webhook handling
async function handlePaymentSuccess(paymentIntent) {
    try {
        await Payment.findOneAndUpdate(
            { paymentIntentId: paymentIntent.id },
            {
                status: 'succeeded',
                paidAt: new Date()
            }
        );

        // Update order status if applicable
        const payment = await Payment.findOne({ paymentIntentId: paymentIntent.id });
        if (payment && payment.order) {
            await Order.findByIdAndUpdate(payment.order, {
                paymentStatus: 'paid',
                paidAt: new Date()
            });
        }
    } catch (error) {
        console.error('Handle payment success error:', error);
    }
}

async function handlePaymentFailure(paymentIntent) {
    try {
        await Payment.findOneAndUpdate(
            { paymentIntentId: paymentIntent.id },
            {
                status: 'failed',
                failureMessage: paymentIntent.last_payment_error?.message || 'Payment failed'
            }
        );
    } catch (error) {
        console.error('Handle payment failure error:', error);
    }
}


export default router;







