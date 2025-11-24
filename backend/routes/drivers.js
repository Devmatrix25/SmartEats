import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { validationResult, body, param } from 'express-validator';
import Driver from '../models/Driver.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { io } from '../server.js';

const router = express.Router();

// Driver middleware - check if user is a driver
const requireDriver = (req, res, next) => {
    if (req.user.role !== 'driver') {
        return res.status(403).json({ message: 'Driver access required' });
    }
    next();
};

// Get driver profile
router.get('/profile', authenticate, requireDriver, async (req, res) => {
    try {
        const driver = await Driver.findOne({ user: req.user._id })
            .populate('user', 'firstName lastName email phone avatar');

        if (!driver) {
            return res.status(404).json({ message: 'Driver profile not found' });
        }

        res.json({ driver });
    } catch (error) {
        console.error('Get driver profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update driver profile
router.put('/profile', authenticate, requireDriver, [
    body('vehicleType').optional().isIn(['bike', 'scooter', 'car', 'bicycle']),
    body('vehicleNumber').optional().trim().escape(),
    body('licenseNumber').optional().trim().escape(),
    body('address').optional().trim().escape()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { vehicleType, vehicleNumber, licenseNumber, address } = req.body;
        
        let driver = await Driver.findOne({ user: req.user._id });

        if (!driver) {
            // Create driver profile if it doesn't exist
            driver = new Driver({ 
                user: req.user._id,
                vehicleType,
                vehicleNumber,
                licenseNumber,
                address
            });
        } else {
            if (vehicleType) driver.vehicleType = vehicleType;
            if (vehicleNumber) driver.vehicleNumber = vehicleNumber;
            if (licenseNumber) driver.licenseNumber = licenseNumber;
            if (address) driver.address = address;
        }

        await driver.save();
        await driver.populate('user', 'firstName lastName email phone avatar');

        res.json({
            message: 'Driver profile updated successfully',
            driver
        });
    } catch (error) {
        console.error('Update driver profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update driver status (online/offline)
router.post('/status', authenticate, requireDriver, [
    body('isOnline').isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { isOnline } = req.body;

        const driver = await Driver.findOneAndUpdate(
            { user: req.user._id },
            { 
                isOnline,
                lastActive: new Date()
            },
            { new: true }
        ).populate('user', 'firstName lastName');

        if (!driver) {
            return res.status(404).json({ message: 'Driver profile not found' });
        }

        // Notify system about driver status change
        io.emit('driver:status', {
            driverId: driver._id,
            isOnline,
            location: driver.currentLocation
        });

        res.json({
            message: `Driver is now ${isOnline ? 'online' : 'offline'}`,
            driver
        });
    } catch (error) {
        console.error('Update driver status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update driver location
router.post('/location', authenticate, requireDriver, [
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { latitude, longitude } = req.body;

        const driver = await Driver.findOneAndUpdate(
            { user: req.user._id },
            { 
                currentLocation: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                lastLocationUpdate: new Date()
            },
            { new: true }
        );

        if (!driver) {
            return res.status(404).json({ message: 'Driver profile not found' });
        }

        // Notify about location update for active deliveries
        const activeDeliveries = await Order.find({
            driver: driver._id,
            status: { $in: ['accepted', 'picked_up', 'out_for_delivery'] }
        });

        activeDeliveries.forEach(order => {
            io.to(order._id.toString()).emit('driver:location', {
                orderId: order._id,
                driverId: driver._id,
                location: { latitude, longitude },
                timestamp: new Date()
            });
        });

        res.json({
            message: 'Location updated successfully',
            location: { latitude, longitude }
        });
    } catch (error) {
        console.error('Update driver location error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get available orders for driver
router.get('/available-orders', authenticate, requireDriver, async (req, res) => {
    try {
        const driver = await Driver.findOne({ user: req.user._id });
        
        if (!driver || !driver.isOnline) {
            return res.status(400).json({ message: 'Driver must be online to receive orders' });
        }

        if (!driver.isVerified) {
            return res.status(400).json({ message: 'Driver account not verified' });
        }

        // Find orders that are ready for pickup and not assigned to any driver
        // In production, use geospatial queries to find nearby orders
        const availableOrders = await Order.find({
            status: 'ready_for_pickup',
            driver: null,
            'restaurant.address.city': driver.currentCity // Simple city-based matching
        })
        .populate('restaurant', 'name address phone')
        .populate('user', 'firstName lastName address')
        .sort({ createdAt: 1 })
        .limit(20);

        res.json({ orders: availableOrders });
    } catch (error) {
        console.error('Get available orders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Accept order request
router.post('/orders/:id/accept', authenticate, requireDriver, [
    param('id').isMongoId()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const driver = await Driver.findOne({ user: req.user._id });
        
        if (!driver.isOnline) {
            return res.status(400).json({ message: 'Driver must be online to accept orders' });
        }

        const order = await Order.findById(req.params.id)
            .populate('restaurant', 'name address phone')
            .populate('user', 'firstName lastName phone address');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status !== 'ready_for_pickup') {
            return res.status(400).json({ message: 'Order is not available for pickup' });
        }

        if (order.driver) {
            return res.status(400).json({ message: 'Order already assigned to another driver' });
        }

        // Assign driver to order
        order.driver = driver._id;
        order.status = 'accepted';
        order.driverAssignedAt = new Date();
        
        await order.save();

        // Update driver's current order
        driver.currentOrder = order._id;
        await driver.save();

        // Notify restaurant and user
        io.to(`restaurant:${order.restaurant._id}`).emit('order:accepted', {
            orderId: order._id,
            driver: {
                _id: driver._id,
                name: `${driver.user.firstName} ${driver.user.lastName}`,
                phone: driver.user.phone
            }
        });

        io.to(order.user._id.toString()).emit('order:update', {
            orderId: order._id,
            status: 'accepted',
            driver: {
                _id: driver._id,
                name: `${driver.user.firstName} ${driver.user.lastName}`,
                phone: driver.user.phone,
                vehicle: driver.vehicleType
            },
            message: 'Driver assigned to your order'
        });

        res.json({
            message: 'Order accepted successfully',
            order
        });
    } catch (error) {
        console.error('Accept order error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reject order request
router.post('/orders/:id/reject', authenticate, requireDriver, [
    param('id').isMongoId()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // In production, you might want to track rejections for driver performance
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Notify system about rejection (could trigger reassignment)
        io.emit('order:rejected', {
            orderId: order._id,
            driverId: req.user._id
        });

        res.json({ message: 'Order rejected' });
    } catch (error) {
        console.error('Reject order error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Mark order as picked up
router.put('/orders/:id/pickup', authenticate, requireDriver, [
    param('id').isMongoId()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const driver = await Driver.findOne({ user: req.user._id });
        const order = await Order.findById(req.params.id)
            .populate('user', 'firstName lastName');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.driver.toString() !== driver._id.toString()) {
            return res.status(403).json({ message: 'Not authorized for this order' });
        }

        if (order.status !== 'accepted') {
            return res.status(400).json({ message: 'Order cannot be marked as picked up' });
        }

        order.status = 'picked_up';
        order.pickedUpAt = new Date();
        await order.save();

        // Notify user
        io.to(order.user._id.toString()).emit('order:update', {
            orderId: order._id,
            status: 'picked_up',
            message: 'Driver has picked up your order',
            pickedUpAt: order.pickedUpAt
        });

        res.json({
            message: 'Order marked as picked up',
            order
        });
    } catch (error) {
        console.error('Mark picked up error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Mark order as delivered
router.put('/orders/:id/delivered', authenticate, requireDriver, [
    param('id').isMongoId()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const driver = await Driver.findOne({ user: req.user._id });
        const order = await Order.findById(req.params.id)
            .populate('user', 'firstName lastName');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.driver.toString() !== driver._id.toString()) {
            return res.status(403).json({ message: 'Not authorized for this order' });
        }

        if (order.status !== 'picked_up') {
            return res.status(400).json({ message: 'Order must be picked up first' });
        }

        order.status = 'delivered';
        order.deliveredAt = new Date();
        order.deliveryEarnings = calculateDeliveryEarnings(order); // Implement this function
        
        await order.save();

        // Update driver earnings and stats
        driver.totalEarnings += order.deliveryEarnings;
        driver.completedDeliveries += 1;
        driver.currentOrder = null;
        await driver.save();

        // Notify user and restaurant
        io.to(order.user._id.toString()).emit('order:update', {
            orderId: order._id,
            status: 'delivered',
            message: 'Order delivered successfully',
            deliveredAt: order.deliveredAt
        });

        io.to(`restaurant:${order.restaurant}`).emit('order:delivered', {
            orderId: order._id,
            deliveredAt: order.deliveredAt
        });

        res.json({
            message: 'Order marked as delivered',
            order,
            earnings: order.deliveryEarnings
        });
    } catch (error) {
        console.error('Mark delivered error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get driver earnings and stats
router.get('/earnings', authenticate, requireDriver, async (req, res) => {
    try {
        const { period = 'week' } = req.query; // week, month, year
        const driver = await Driver.findOne({ user: req.user._id });

        if (!driver) {
            return res.status(404).json({ message: 'Driver profile not found' });
        }

        // Calculate earnings for the period
        const startDate = getPeriodStartDate(period);
        
        const periodEarnings = await Order.aggregate([
            {
                $match: {
                    driver: driver._id,
                    status: 'delivered',
                    deliveredAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalEarnings: { $sum: '$deliveryEarnings' },
                    totalOrders: { $sum: 1 }
                }
            }
        ]);

        const earnings = periodEarnings[0] || { totalEarnings: 0, totalOrders: 0 };

        res.json({
            totalEarnings: driver.totalEarnings,
            completedDeliveries: driver.completedDeliveries,
            periodEarnings: earnings.totalEarnings,
            periodOrders: earnings.totalOrders,
            rating: driver.rating,
            period
        });
    } catch (error) {
        console.error('Get earnings error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get driver delivery history
router.get('/deliveries', authenticate, requireDriver, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const driver = await Driver.findOne({ user: req.user._id });

        const deliveries = await Order.find({ driver: driver._id, status: 'delivered' })
            .populate('restaurant', 'name avatar')
            .populate('user', 'firstName lastName address')
            .sort({ deliveredAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Order.countDocuments({ driver: driver._id, status: 'delivered' });

        res.json({
            deliveries,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Get deliveries error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper functions
function calculateDeliveryEarnings(order) {
    // Simple earnings calculation based on distance and order value
    // In production, implement more complex logic
    const baseEarning = 30; // Base delivery charge
    const distanceBonus = 0; // Calculate based on actual distance
    const orderValueBonus = order.totalAmount * 0.05; // 5% of order value
    
    return baseEarning + distanceBonus + orderValueBonus;
}

function getPeriodStartDate(period) {
    const now = new Date();
    switch (period) {
        case 'week':
            return new Date(now.setDate(now.getDate() - 7));
        case 'month':
            return new Date(now.setMonth(now.getMonth() - 1));
        case 'year':
            return new Date(now.setFullYear(now.getFullYear() - 1));
        default:
            return new Date(now.setDate(now.getDate() - 7));
    }
}

export default router;