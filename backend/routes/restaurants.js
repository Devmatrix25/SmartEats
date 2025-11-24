import express from 'express';
import Restaurant from '../models/Restaurant.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Get all restaurants with filters
router.get('/', optionalAuth, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 9,
            cuisine,
            rating,
            sort = 'rating',
            search,
            lat,
            lng
        } = req.query;

        const skip = (page - 1) * parseInt(limit);
        
        let query = { isActive: true, isVerified: true };
        
        // Cuisine filter
        if (cuisine && cuisine !== 'all') {
            query.cuisine = { $in: [cuisine] };
        }
        
        // Rating filter
        if (rating && rating !== '0') {
            query.rating = { $gte: parseFloat(rating) };
        }
        
        // Search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { cuisine: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Sort options
        let sortOptions = {};
        switch (sort) {
            case 'rating':
                sortOptions = { rating: -1 };
                break;
            case 'deliveryTime':
                sortOptions = { 'deliveryInfo.deliveryTime': 1 };
                break;
            case 'name':
                sortOptions = { name: 1 };
                break;
            case 'deliveryFee':
                sortOptions = { 'deliveryInfo.deliveryFee': 1 };
                break;
            default:
                sortOptions = { rating: -1 };
        }

        const restaurants = await Restaurant.find(query)
            .select('-menu -analytics')
            .skip(skip)
            .limit(parseInt(limit))
            .sort(sortOptions);

        const total = await Restaurant.countDocuments(query);
        const hasMore = skip + restaurants.length < total;

        res.json({
            restaurants,
            total,
            hasMore,
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error('Get restaurants error:', error);
        res.status(500).json({ message: 'Error fetching restaurants' });
    }
});

// Get restaurant by ID
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id)
            .populate('owner', 'firstName lastName email phone');

        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }

        res.json(restaurant);
    } catch (error) {
        console.error('Get restaurant error:', error);
        res.status(500).json({ message: 'Error fetching restaurant' });
    }
});

// Get restaurant menu
router.get('/:id/menu', optionalAuth, async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id)
            .select('menu name');

        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }

        // Filter available items only
        const availableMenu = restaurant.menu.filter(item => item.availability);

        res.json({
            restaurant: {
                _id: restaurant._id,
                name: restaurant.name
            },
            menu: availableMenu
        });
    } catch (error) {
        console.error('Get menu error:', error);
        res.status(500).json({ message: 'Error fetching menu' });
    }
});

// Get available cuisines
router.get('/cuisines/list', async (req, res) => {
    try {
        const cuisines = await Restaurant.distinct('cuisine', { isActive: true, isVerified: true });
        res.json(cuisines.filter(cuisine => cuisine)); // Remove null/undefined values
    } catch (error) {
        console.error('Get cuisines error:', error);
        res.status(500).json({ message: 'Error fetching cuisines' });
    }
});

// Search restaurants and dishes
router.get('/search/all', async (req, res) => {
    try {
        const { q, lat, lng } = req.query;
        
        if (!q) {
            return res.status(400).json({ message: 'Search query required' });
        }

        // Search restaurants
        const restaurants = await Restaurant.find({
            isActive: true,
            isVerified: true,
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { cuisine: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } }
            ]
        }).select('name cuisine rating deliveryInfo images').limit(10);

        // Search menu items across all restaurants
        const menuItems = await Restaurant.aggregate([
            { $match: { isActive: true, isVerified: true } },
            { $unwind: '$menu' },
            { $match: { 
                'menu.availability': true,
                $or: [
                    { 'menu.name': { $regex: q, $options: 'i' } },
                    { 'menu.description': { $regex: q, $options: 'i' } },
                    { 'menu.category': { $regex: q, $options: 'i' } }
                ]
            }},
            { $project: {
                restaurantId: '$_id',
                restaurantName: '$name',
                item: '$menu',
                deliveryInfo: 1
            }},
            { $limit: 10 }
        ]);

        res.json({
            restaurants,
            menuItems: menuItems.map(item => ({
                ...item.item,
                restaurant: {
                    _id: item.restaurantId,
                    name: item.restaurantName,
                    deliveryInfo: item.deliveryInfo
                }
            }))
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Error performing search' });
    }
});

export default router;