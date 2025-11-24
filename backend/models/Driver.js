import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Restaurant from '../models/Restaurant.js';
import User from '../models/User.js';
import { io } from '../server.js';

const router = express.Router();

// Create new order
router.post('/', authenticate, async (req, res) => {
    try {
        const { 
            restaurantId, 
            items, 
            deliveryAddress, 
            paymentMethod,
            specialInstructions,
            coupons 
        } = req.body;

        // Validate restaurant
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant || !restaurant.isActive || !restaurant.isVerified) {
            return res.status(400).json({ message: 'Restaurant not available' });
        }

        // Calculate order totals
        let orderTotal = 0;
        const orderItems = items.map(item => {
            const menuItem = restaurant.menu.id(item.menuItemId);
            if (!menuItem || !menuItem.availability) {
                throw new Error(`Item ${item.name} is not available`);
            }

            const itemTotal = menuItem.price * item.quantity;
            orderTotal += itemTotal;

            return {
                menuItem: item.menuItemId,
                name: menuItem.name,
                price: menuItem.price,
                quantity: item.quantity,
                specialInstructions: item.specialInstructions,
                total: itemTotal
            };
        });

        // Check minimum order
        if (orderTotal < restaurant.deliveryInfo.minOrder) {
            return res.status(400).json({ 
                message: `Minimum order amount is ${restaurant.deliveryInfo.minOrder}` 
            });
        }

        // Calculate delivery fee
        const deliveryFee = restaurant.deliveryInfo.deliveryFee;
        
        // Calculate tax (simplified)
        const tax = orderTotal * 0.05; // 5% tax

        // Apply coupons (simplified)
        let discount = 0;
        if (coupons && coupons.length > 0) {
            // In production, validate coupons against database
            discount = orderTotal * 0.1; // 10% discount for demo
        }

        const finalAmount = orderTotal + deliveryFee + tax - discount;

        // Create order
        const order = new Order({
            customer: req.user._id,
            restaurant: restaurantId,
            items: orderItems,
            orderTotal,
            deliveryFee,
            tax,
            discount,
            finalAmount,
            deliveryAddress,
            payment: {
                method: paymentMethod,
                status: paymentMethod === 'cash' ? 'pending' : 'completed'
            },
            specialInstructions,
            coupons,
            preparationTime: restaurant.deliveryInfo.deliveryTime,
            deliveryTime: 30 // Default delivery time
        });

        await order.save();

        // Populate order for response
        await order.populate('customer restaurant');
        
        // Notify restaurant
        io.to(`restaurant:${restaurantId}`).emit('order:new', {
            orderId: order._id,
            order: order.toJSON()
        });

        res.status(201).json({
            message: 'Order placed successfully',
            order: order.toJSON()
        });
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ 
            message: error.message || 'Error creating order' 
        });
    }
});

// Get user orders
router.get('/', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const skip = (page - 1) * limit;

        let query = { customer: req.user._id };
        if (status && status !== 'all') {
            query.status = status;
        }

        const orders = await Order.find(query)
            .populate('restaurant driver')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Order.countDocuments(query);

        res.json({
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ message: 'Error fetching orders' });
    }
});

// Get order details
router.get('/:id', authenticate, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer restaurant driver');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user has permission to view this order
        if (order.customer._id.toString() !== req.user._id.toString() && 
            req.user.role !== 'admin' && 
            req.user.role !== 'restaurant') {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(order);
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ message: 'Error fetching order' });
    }
});

// Restaurant order management
router.get('/restaurant/orders', authenticate, authorize('restaurant'), async (req, res) => {
    try {
        const { status } = req.query;
        
        // Find restaurant owned by user
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }

        let query = { restaurant: restaurant._id };
        if (status && status !== 'all') {
            query.status = status;
        }

        const orders = await Order.find(query)
            .populate('customer')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(orders);
    } catch (error) {
        console.error('Restaurant orders error:', error);
        res.status(500).json({ message: 'Error fetching restaurant orders' });
    }
});

// Accept/reject order (restaurant)
router.post('/restaurant/orders/:id/accept', authenticate, authorize('restaurant'), async (req, res) => {
    try {
        const { action } = req.body; // 'accept' or 'reject'
        const order = await Order.findById(req.params.id)
            .populate('restaurant customer');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if restaurant owns this order
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        if (order.restaurant._id.toString() !== restaurant._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (action === 'accept') {
            order.status = 'confirmed';
            await order.save();

            // Notify customer
            io.to(order.customer._id.toString()).emit('order:update', {
                orderId: order._id,
                status: 'confirmed',
                message: 'Restaurant has accepted your order'
            });

            res.json({ message: 'Order accepted successfully' });
        } else if (action === 'reject') {
            order.status = 'rejected';
            await order.save();

            // Notify customer
            io.to(order.customer._id.toString()).emit('order:update', {
                orderId: order._id,
                status: 'rejected',
                message: 'Restaurant has rejected your order'
            });

            // TODO: Process refund if payment was made
            res.json({ message: 'Order rejected' });
        } else {
            res.status(400).json({ message: 'Invalid action' });
        }
    } catch (error) {
        console.error('Order accept/reject error:', error);
        res.status(500).json({ message: 'Error processing order' });
    }
});

// Mark order as ready (restaurant)
router.post('/restaurant/orders/:id/ready', authenticate, authorize('restaurant'), async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('restaurant customer');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if restaurant owns this order
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        if (order.restaurant._id.toString() !== restaurant._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        order.status = 'ready';
        await order.save();

        // Notify customer and available drivers
        io.to(order.customer._id.toString()).emit('order:update', {
            orderId: order._id,
            status: 'ready',
            message: 'Your order is ready for pickup'
        });

        // Notify drivers about available order
        io.to('drivers').emit('order:request', {
            orderId: order._id,
            restaurant: order.restaurant,
            deliveryAddress: order.deliveryAddress,
            deliveryEarnings: order.deliveryFee * 0.8 // 80% of delivery fee goes to driver
        });

        res.json({ message: 'Order marked as ready' });
    } catch (error) {
        console.error('Mark order ready error:', error);
        res.status(500).json({ message: 'Error updating order status' });
    }
});

export default router;