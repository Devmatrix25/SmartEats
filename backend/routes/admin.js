import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import User from '../models/User.js';
import Restaurant from '../models/Restaurant.js';
import Order from '../models/Order.js';
import Driver from '../models/Driver.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// Get admin dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        const { range = 'week' } = req.query;
        
        // Calculate date ranges
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
            case 'year':
                startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 7));
        }

        // Get total counts
        const totalOrders = await Order.countDocuments();
        const totalRevenue = await Order.aggregate([
            { $match: { status: 'delivered' } },
            { $group: { _id: null, total: { $sum: '$finalAmount' } } }
        ]);
        
        const totalUsers = await User.countDocuments({ role: 'customer' });
        const totalRestaurants = await Restaurant.countDocuments({ isActive: true, isVerified: true });

        // Get current period stats
        const currentOrders = await Order.countDocuments({ 
            createdAt: { $gte: startDate } 
        });
        
        const currentRevenue = await Order.aggregate([
            { 
                $match: { 
                    status: 'delivered',
                    createdAt: { $gte: startDate }
                } 
            },
            { $group: { _id: null, total: { $sum: '$finalAmount' } } }
        ]);

        const currentUsers = await User.countDocuments({ 
            role: 'customer',
            createdAt: { $gte: startDate }
        });

        // Get previous period for growth calculation
        const previousStartDate = new Date(startDate);
        const previousEndDate = new Date(startDate);
        const periodDiff = now - startDate;
        
        previousStartDate.setTime(previousStartDate.getTime() - periodDiff);
        previousEndDate.setTime(previousEndDate.getTime() - periodDiff);

        const previousOrders = await Order.countDocuments({
            createdAt: { 
                $gte: previousStartDate,
                $lte: previousEndDate
            }
        });

        const previousRevenue = await Order.aggregate([
            { 
                $match: { 
                    status: 'delivered',
                    createdAt: { 
                        $gte: previousStartDate,
                        $lte: previousEndDate
                    }
                } 
            },
            { $group: { _id: null, total: { $sum: '$finalAmount' } } }
        ]);

        const previousUsers = await User.countDocuments({
            role: 'customer',
            createdAt: { 
                $gte: previousStartDate,
                $lte: previousEndDate
            }
        });

        // Calculate growth percentages
        const ordersGrowth = previousOrders > 0 ? 
            ((currentOrders - previousOrders) / previousOrders * 100).toFixed(1) : 0;
        
        const revenueGrowth = previousRevenue.length > 0 && previousRevenue[0].total > 0 ? 
            ((currentRevenue[0]?.total - previousRevenue[0].total) / previousRevenue[0].total * 100).toFixed(1) : 0;
        
        const usersGrowth = previousUsers > 0 ? 
            ((currentUsers - previousUsers) / previousUsers * 100).toFixed(1) : 0;

        // Calculate AOV
        const aovCurrent = currentOrders > 0 ? (currentRevenue[0]?.total || 0) / currentOrders : 0;
        const aovPrevious = previousOrders > 0 ? (previousRevenue[0]?.total || 0) / previousOrders : 0;
        const aovGrowth = aovPrevious > 0 ? ((aovCurrent - aovPrevious) / aovPrevious * 100).toFixed(1) : 0;

        res.json({
            totalOrders,
            totalRevenue: totalRevenue[0]?.total || 0,
            totalUsers,
            totalRestaurants,
            revenue: {
                current: currentRevenue[0]?.total || 0,
                previous: previousRevenue[0]?.total || 0,
                growth: parseFloat(revenueGrowth)
            },
            orders: {
                current: currentOrders,
                previous: previousOrders,
                growth: parseFloat(ordersGrowth)
            },
            users: {
                current: currentUsers,
                previous: previousUsers,
                growth: parseFloat(usersGrowth)
            },
            aov: {
                current: Math.round(aovCurrent),
                previous: Math.round(aovPrevious),
                growth: parseFloat(aovGrowth)
            }
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ message: 'Error fetching admin statistics' });
    }
});

// Get analytics data for charts
router.get('/analytics', async (req, res) => {
    try {
        const { range = 'week' } = req.query;
        
        // Generate date ranges based on the selected range
        const dates = generateDateRange(range);
        
        // Revenue trend data
        const revenueData = await Order.aggregate([
            {
                $match: {
                    status: 'delivered',
                    createdAt: { $gte: dates[0] }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { 
                            format: range === 'year' ? '%Y-%m' : '%Y-%m-%d', 
                            date: '$createdAt' 
                        }
                    },
                    revenue: { $sum: '$finalAmount' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Order status distribution
        const orderStatusData = await Order.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Top restaurants by orders
        const topRestaurants = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: dates[0] }
                }
            },
            {
                $group: {
                    _id: '$restaurant',
                    orderCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'restaurants',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'restaurant'
                }
            },
            { $unwind: '$restaurant' },
            { $sort: { orderCount: -1 } },
            { $limit: 5 }
        ]);

        // User registration trend
        const userRegistrations = await User.aggregate([
            {
                $match: {
                    role: 'customer',
                    createdAt: { $gte: dates[0] }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { 
                            format: range === 'year' ? '%Y-%m' : '%Y-%m-%d', 
                            date: '$createdAt' 
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Format response data
        const response = {
            revenue: {
                labels: revenueData.map(item => item._id),
                data: revenueData.map(item => item.revenue)
            },
            orders: {
                labels: orderStatusData.map(item => 
                    item._id.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')
                ),
                data: orderStatusData.map(item => item.count)
            },
            topRestaurants: {
                labels: topRestaurants.map(item => item.restaurant.name),
                data: topRestaurants.map(item => item.orderCount)
            },
            userRegistrations: {
                labels: userRegistrations.map(item => item._id),
                data: userRegistrations.map(item => item.count)
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ message: 'Error fetching analytics data' });
    }
});

// Get recent activities
router.get('/activities', async (req, res) => {
    try {
        // Get recent orders
        const recentOrders = await Order.find()
            .populate('customer restaurant')
            .sort({ createdAt: -1 })
            .limit(10);

        // Get recent user registrations
        const recentUsers = await User.find({ role: 'customer' })
            .sort({ createdAt: -1 })
            .limit(5);

        // Get pending restaurant approvals
        const pendingRestaurants = await Restaurant.find({ isVerified: false })
            .populate('owner')
            .limit(5);

        // Format activities
        const activities = [
            ...recentOrders.map(order => ({
                type: 'order',
                title: `New Order #${order.orderId}`,
                description: `Order from ${order.customer.firstName} to ${order.restaurant.name}`,
                timestamp: order.createdAt
            })),
            ...recentUsers.map(user => ({
                type: 'user',
                title: 'New User Registration',
                description: `${user.firstName} ${user.lastName} joined SmartEats`,
                timestamp: user.createdAt
            })),
            ...pendingRestaurants.map(restaurant => ({
                type: 'restaurant',
                title: 'Restaurant Pending Approval',
                description: `${restaurant.name} waiting for verification`,
                timestamp: restaurant.createdAt
            }))
        ];

        // Sort by timestamp and limit to 15 activities
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json(activities.slice(0, 15));
    } catch (error) {
        console.error('Activities error:', error);
        res.status(500).json({ message: 'Error fetching activities' });
    }
});

// User management
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 10, role, search } = req.query;
        const skip = (page - 1) * limit;

        let query = {};
        if (role) query.role = role;
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        console.error('Users management error:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

// Restaurant management
router.get('/restaurants', async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const skip = (page - 1) * limit;

        let query = {};
        if (status === 'pending') {
            query.isVerified = false;
        } else if (status === 'active') {
            query.isVerified = true;
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { cuisine: { $regex: search, $options: 'i' } }
            ];
        }

        const restaurants = await Restaurant.find(query)
            .populate('owner')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Restaurant.countDocuments(query);

        res.json({
            restaurants,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        console.error('Restaurants management error:', error);
        res.status(500).json({ message: 'Error fetching restaurants' });
    }
});

// Approve/Reject restaurant
router.post('/restaurants/:id/verify', async (req, res) => {
    try {
        const { action } = req.body; // 'approve' or 'reject'
        const { id } = req.params;

        const restaurant = await Restaurant.findById(id);
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }

        if (action === 'approve') {
            restaurant.isVerified = true;
            restaurant.isActive = true;
            await restaurant.save();
            
            // TODO: Send notification to restaurant owner
            
            res.json({ message: 'Restaurant approved successfully' });
        } else if (action === 'reject') {
            // TODO: Send rejection notification
            await Restaurant.findByIdAndDelete(id);
            res.json({ message: 'Restaurant application rejected' });
        } else {
            res.status(400).json({ message: 'Invalid action' });
        }
    } catch (error) {
        console.error('Restaurant verification error:', error);
        res.status(500).json({ message: 'Error processing restaurant verification' });
    }
});

// Driver management
router.get('/drivers', async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const skip = (page - 1) * limit;

        let query = { role: 'driver' };
        if (status === 'pending') {
            query.isVerified = false;
        } else if (status === 'active') {
            query.isVerified = true;
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const drivers = await User.find(query)
            .select('-password')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        res.json({
            drivers,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        console.error('Drivers management error:', error);
        res.status(500).json({ message: 'Error fetching drivers' });
    }
});

// Verify driver
router.post('/drivers/:id/verify', async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body;

        const driver = await User.findById(id);
        if (!driver || driver.role !== 'driver') {
            return res.status(404).json({ message: 'Driver not found' });
        }

        if (action === 'approve') {
            driver.isVerified = true;
            await driver.save();
            
            // TODO: Send notification to driver
            
            res.json({ message: 'Driver verified successfully' });
        } else if (action === 'reject') {
            // TODO: Handle driver rejection
            driver.isActive = false;
            await driver.save();
            res.json({ message: 'Driver application rejected' });
        } else {
            res.status(400).json({ message: 'Invalid action' });
        }
    } catch (error) {
        console.error('Driver verification error:', error);
        res.status(500).json({ message: 'Error processing driver verification' });
    }
});

// Order management
router.get('/orders', async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const skip = (page - 1) * limit;

        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { orderId: { $regex: search, $options: 'i' } }
            ];
        }

        const orders = await Order.find(query)
            .populate('customer restaurant driver')
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
        console.error('Orders management error:', error);
        res.status(500).json({ message: 'Error fetching orders' });
    }
});

// Helper function to generate date ranges
function generateDateRange(range) {
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
        case 'year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
        default:
            startDate = new Date(now.setDate(now.getDate() - 7));
    }

    return [startDate, new Date()];
}

export default router;