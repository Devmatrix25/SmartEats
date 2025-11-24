import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import Restaurant from '../models/Restaurant.js';
import Order from '../models/Order.js';
import { io } from '../server.js';

const router = express.Router();

// All routes require restaurant authentication
router.use(authenticate);
router.use(authorize('restaurant'));

// Get restaurant profile
router.get('/profile', async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne({ owner: req.user._id })
            .populate('owner', 'firstName lastName email phone');
        
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        res.json(restaurant);
    } catch (error) {
        console.error('Get restaurant profile error:', error);
        res.status(500).json({ message: 'Error fetching restaurant profile' });
    }
});

// Update restaurant profile
router.put('/profile', async (req, res) => {
    try {
        const {
            name,
            description,
            cuisine,
            address,
            contact,
            operatingHours,
            deliveryInfo
        } = req.body;
        
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        // Update fields
        if (name) restaurant.name = name;
        if (description) restaurant.description = description;
        if (cuisine) restaurant.cuisine = cuisine;
        if (address) restaurant.address = address;
        if (contact) restaurant.contact = contact;
        if (operatingHours) restaurant.operatingHours = operatingHours;
        if (deliveryInfo) restaurant.deliveryInfo = deliveryInfo;
        
        await restaurant.save();
        
        res.json({
            message: 'Restaurant profile updated successfully',
            restaurant
        });
    } catch (error) {
        console.error('Update restaurant profile error:', error);
        res.status(500).json({ message: 'Error updating restaurant profile' });
    }
});

// Menu Management

// Get restaurant menu
router.get('/menu', async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne({ owner: req.user._id })
            .select('menu');
        
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        res.json({
            menu: restaurant.menu
        });
    } catch (error) {
        console.error('Get menu error:', error);
        res.status(500).json({ message: 'Error fetching menu' });
    }
});

// Get menu categories
router.get('/menu/categories', async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        const categories = [...new Set(restaurant.menu.map(item => item.category))];
        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ message: 'Error fetching categories' });
    }
});

// Add menu item
router.post('/menu', async (req, res) => {
    try {
        const {
            name,
            description,
            price,
            originalPrice,
            category,
            ingredients,
            preparationTime,
            tags,
            dietaryInfo,
            availability = true
        } = req.body;
        
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        const newItem = {
            name,
            description,
            price,
            originalPrice,
            category,
            ingredients: ingredients || [],
            preparationTime: preparationTime || 15,
            tags: tags || [],
            dietaryInfo: dietaryInfo || {},
            availability
        };
        
        restaurant.menu.push(newItem);
        await restaurant.save();
        
        res.status(201).json({
            message: 'Menu item added successfully',
            item: restaurant.menu[restaurant.menu.length - 1]
        });
    } catch (error) {
        console.error('Add menu item error:', error);
        res.status(500).json({ message: 'Error adding menu item' });
    }
});

// Update menu item
router.put('/menu/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const updateData = req.body;
        
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        const menuItem = restaurant.menu.id(itemId);
        if (!menuItem) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        
        // Update fields
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                if (key === 'dietaryInfo') {
                    menuItem.dietaryInfo = { ...menuItem.dietaryInfo, ...updateData[key] };
                } else {
                    menuItem[key] = updateData[key];
                }
            }
        });
        
        await restaurant.save();
        
        res.json({
            message: 'Menu item updated successfully',
            item: menuItem
        });
    } catch (error) {
        console.error('Update menu item error:', error);
        res.status(500).json({ message: 'Error updating menu item' });
    }
});

// Update menu item availability
router.put('/menu/:itemId/availability', async (req, res) => {
    try {
        const { itemId } = req.params;
        const { availability } = req.body;
        
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        const menuItem = restaurant.menu.id(itemId);
        if (!menuItem) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        
        menuItem.availability = availability;
        await restaurant.save();
        
        res.json({
            message: `Menu item ${availability ? 'enabled' : 'disabled'} successfully`,
            item: menuItem
        });
    } catch (error) {
        console.error('Update availability error:', error);
        res.status(500).json({ message: 'Error updating item availability' });
    }
});

// Delete menu item
router.delete('/menu/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        const menuItem = restaurant.menu.id(itemId);
        if (!menuItem) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        
        restaurant.menu.pull(itemId);
        await restaurant.save();
        
        res.json({
            message: 'Menu item deleted successfully'
        });
    } catch (error) {
        console.error('Delete menu item error:', error);
        res.status(500).json({ message: 'Error deleting menu item' });
    }
});

// Order Management

// Get restaurant orders
router.get('/orders', async (req, res) => {
    try {
        const { status, range = 'today', search } = req.query;
        
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        let query = { restaurant: restaurant._id };
        
        // Status filter
        if (status && status !== 'all') {
            query.status = status;
        }
        
        // Time range filter
        if (range !== 'all') {
            const now = new Date();
            let startDate;
            
            switch (range) {
                case 'today':
                    startDate = new Date(now.setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    startDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                default:
                    startDate = new Date(now.setHours(0, 0, 0, 0));
            }
            
            query.createdAt = { $gte: startDate };
        }
        
        // Search filter
        if (search) {
            query.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                { 'customer.firstName': { $regex: search, $options: 'i' } },
                { 'customer.lastName': { $regex: search, $options: 'i' } }
            ];
        }
        
        const orders = await Order.find(query)
            .populate('customer', 'firstName lastName email phone')
            .populate('driver', 'firstName lastName phone')
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.json({ orders });
    } catch (error) {
        console.error('Get restaurant orders error:', error);
        res.status(500).json({ message: 'Error fetching orders' });
    }
});

// Get specific order
router.get('/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        const order = await Order.findOne({ 
            _id: orderId, 
            restaurant: restaurant._id 
        })
        .populate('customer', 'firstName lastName email phone')
        .populate('driver', 'firstName lastName phone');
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        res.json(order);
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ message: 'Error fetching order' });
    }
});

// Accept/Reject order
router.post('/orders/:orderId/accept', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action } = req.body; // 'accept' or 'reject'
        
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        const order = await Order.findOne({ 
            _id: orderId, 
            restaurant: restaurant._id 
        }).populate('customer');
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
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
        console.error('Accept/Reject order error:', error);
        res.status(500).json({ message: 'Error processing order' });
    }
});

// Update order status
router.put('/orders/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        const order = await Order.findOne({ 
            _id: orderId, 
            restaurant: restaurant._id 
        }).populate('customer');
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        order.status = status;
        await order.save();
        
        // Notify customer
        io.to(order.customer._id.toString()).emit('order:update', {
            orderId: order._id,
            status: status,
            message: `Order status updated to ${status}`
        });
        
        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ message: 'Error updating order status' });
    }
});

// Mark order as ready
router.post('/orders/:orderId/ready', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        const order = await Order.findOne({ 
            _id: orderId, 
            restaurant: restaurant._id 
        }).populate('customer');
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        order.status = 'ready';
        await order.save();
        
        // Notify customer
        io.to(order.customer._id.toString()).emit('order:update', {
            orderId: order._id,
            status: 'ready',
            message: 'Your order is ready for pickup'
        });
        
        // Notify available drivers
        io.to('drivers').emit('order:request', {
            orderId: order._id,
            restaurant: restaurant,
            deliveryAddress: order.deliveryAddress,
            deliveryEarnings: order.deliveryFee * 0.8 // 80% of delivery fee goes to driver
        });
        
        res.json({ message: 'Order marked as ready' });
    } catch (error) {
        console.error('Mark order ready error:', error);
        res.status(500).json({ message: 'Error updating order status' });
    }
});

// Analytics and Sales

// Get sales analytics
router.get('/analytics/sales', async (req, res) => {
    try {
        const { range = 'week' } = req.query;
        
        const restaurant = await Restaurant.findOne({ owner: req.user._id });
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        // Calculate date range
        const now = new Date();
        let startDate;
        
        switch (range) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 7));
        }
        
        // Sales data
        const salesData = await Order.aggregate([
            {
                $match: {
                    restaurant: restaurant._id,
                    status: 'delivered',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { 
                            format: range === 'month' ? '%Y-%m-%d' : '%Y-%m-%d', 
                            date: '$createdAt' 
                        }
                    },
                    revenue: { $sum: '$finalAmount' },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        // Top items
        const topItems = await Order.aggregate([
            {
                $match: {
                    restaurant: restaurant._id,
                    status: 'delivered',
                    createdAt: { $gte: startDate }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.name',
                    quantity: { $sum: '$items.quantity' },
                    revenue: { $sum: '$items.total' }
                }
            },
            { $sort: { quantity: -1 } },
            { $limit: 5 }
        ]);
        
        // Order statistics
        const orderStats = await Order.aggregate([
            {
                $match: {
                    restaurant: restaurant._id,
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        res.json({
            salesData,
            topItems,
            orderStats,
            totalRevenue: salesData.reduce((sum, day) => sum + day.revenue, 0),
            totalOrders: salesData.reduce((sum, day) => sum + day.orders, 0)
        });
    } catch (error) {
        console.error('Sales analytics error:', error);
        res.status(500).json({ message: 'Error fetching sales analytics' });
    }
});

export default router;