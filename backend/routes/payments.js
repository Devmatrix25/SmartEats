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
    body('orderId').optional().isMongoId(),
    body('amount').isFloat({ min: 1 }),
    body('currency').optional().isIn(['INR', 'USD']).default('INR')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { orderId, amount, currency } = req.body;

        // Create a real Stripe PaymentIntent
const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // convert INR → paise
    currency: currency.toLowerCase(),
    automatic_payment_methods: { enabled: true }
});

        // Store payment intent in database
        const payment = new Payment({
            user: req.user._id,
            order: orderId,
            paymentIntentId: paymentIntent.id,
            amount,
            currency,
            status: 'pending'
        });

        await payment.save();

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount,
            currency
        });
    } catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({ message: 'Payment processing error' });
    }
});

// Confirm payment
router.post('/confirm', authenticate, [
    body('paymentIntentId').notEmpty(),
    body('orderId').optional().isMongoId()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { paymentIntentId, orderId } = req.body;
        
        await Payment.findOneAndUpdate(
    { paymentIntentId },
    {
        status: 'succeeded',
        paidAt: new Date()
    }
);
        if (!isPaymentSuccessful) {
            return res.status(400).json({ message: 'Payment failed. Please try again.' });
        }

        let order;

        if (orderId) {
            // Update existing order
            order = await Order.findByIdAndUpdate(
                orderId,
                {
                    paymentStatus: 'paid',
                    status: 'confirmed',
                    paidAt: new Date()
                },
                { new: true }
            ).populate('restaurant', 'name');

            if (!order) {
                return res.status(404).json({ message: 'Order not found' });
            }
        } else {
            // Create new order from cart
            const cart = await Cart.findOne({ user: req.user._id })
                .populate('items.menuItem', 'name price isAvailable')
                .populate('restaurant', 'name isOpen minOrder deliveryTime');

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({ message: 'Cart is empty' });
            }

            if (!cart.restaurant.isOpen) {
                return res.status(400).json({ message: 'Restaurant is currently closed' });
            }

            // Calculate order total
            const subtotal = cart.items.reduce((total, item) => {
                return total + (item.price * item.quantity);
            }, 0);

            if (subtotal < cart.restaurant.minOrder) {
                return res.status(400).json({ 
                    message: `Minimum order amount is ₹${cart.restaurant.minOrder}` 
                });
            }

            const deliveryFee = cart.restaurant.deliveryFee || 30;
            const tax = subtotal * 0.05; // 5% tax
            const total = subtotal + deliveryFee + tax - (cart.coupon?.discount || 0);

            // Create order
            order = new Order({
                user: req.user._id,
                restaurant: cart.restaurant._id,
                items: cart.items.map(item => ({
                    menuItem: item.menuItem._id,
                    name: item.menuItem.name,
                    price: item.price,
                    quantity: item.quantity,
                    specialInstructions: item.specialInstructions
                })),
                subtotal,
                deliveryFee,
                tax,
                discount: cart.coupon?.discount || 0,
                totalAmount: total,
                deliveryAddress: req.user.address,
                paymentStatus: 'paid',
                status: 'confirmed',
                paidAt: new Date()
            });

            await order.save();
            await order.populate('restaurant', 'name address phone');
            await order.populate('user', 'firstName lastName phone');

            // Clear cart
            cart.items = [];
            cart.restaurant = null;
            cart.coupon = null;
            await cart.save();
        }

        // Update payment record
        await Payment.findOneAndUpdate(
            { paymentIntentId },
            {
                status: 'succeeded',
                paidAt: new Date(),
                order: order._id
            }
        );

        // Notify restaurant
        const io = req.app.get('io');
        io.to(`restaurant:${order.restaurant._id}`).emit('order:new', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            items: order.items,
            totalAmount: order.totalAmount,
            user: order.user
        });

        res.json({
            message: 'Payment successful',
            order: {
                _id: order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                totalAmount: order.totalAmount,
                restaurant: order.restaurant
            }
        });
    } catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({ message: 'Payment confirmation failed' });
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
