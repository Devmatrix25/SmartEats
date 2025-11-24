import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { validationResult, body, param } from 'express-validator';
import User from '../models/User.js';
import Restaurant from '../models/Restaurant.js';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';

const router = express.Router();

// Get user profile
router.get('/profile', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json({ user });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user profile
router.put('/profile', authenticate, [
    body('firstName').optional().trim().escape(),
    body('lastName').optional().trim().escape(),
    body('phone').optional().isMobilePhone(),
    body('address').optional().trim().escape()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { firstName, lastName, phone, address } = req.body;
        
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (phone) user.phone = phone;
        if (address) user.address = address;

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: user.toJSON()
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Search restaurants
router.get('/restaurants', async (req, res) => {
    try {
        const { lat, lng, q, cuisine, page = 1, limit = 20 } = req.query;
        
        let query = { isActive: true, isVerified: true };
        
        // Search by name or cuisine
        if (q) {
            query.$or = [
                { name: { $regex: q, $options: 'i' } },
                { cuisine: { $regex: q, $options: 'i' } },
                { 'address.area': { $regex: q, $options: 'i' } }
            ];
        }
        
        if (cuisine) {
            query.cuisine = { $regex: cuisine, $options: 'i' };
        }

        // Geo-based search (simplified - in production use MongoDB geospatial queries)
        const restaurants = await Restaurant.find(query)
            .select('name cuisine address rating deliveryTime minOrder isOpen avatar')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ rating: -1, deliveryTime: 1 });

        const total = await Restaurant.countDocuments(query);

        res.json({
            restaurants,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Search restaurants error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get restaurant details
router.get('/restaurants/:id', [
    param('id').isMongoId()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const restaurant = await Restaurant.findById(req.params.id)
            .select('-menu._id'); // Exclude menu item IDs for cleaner response

        if (!restaurant || !restaurant.isActive) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }

        res.json({ restaurant });
    } catch (error) {
        console.error('Get restaurant error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get restaurant menu
router.get('/restaurants/:id/menu', [
    param('id').isMongoId()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const restaurant = await Restaurant.findById(req.params.id)
            .select('menu name isOpen');

        if (!restaurant || !restaurant.isActive) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }

        if (!restaurant.isOpen) {
            return res.status(400).json({ message: 'Restaurant is currently closed' });
        }

        // Filter available items only
        const availableMenu = restaurant.menu.filter(item => item.isAvailable);

        res.json({
            restaurant: {
                name: restaurant.name,
                isOpen: restaurant.isOpen
            },
            menu: availableMenu
        });
    } catch (error) {
        console.error('Get menu error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Cart management
router.get('/cart', authenticate, async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id })
            .populate('items.restaurant', 'name')
            .populate('items.menuItem', 'name price image isAvailable');

        if (!cart) {
            cart = new Cart({ user: req.user._id, items: [] });
            await cart.save();
        }

        res.json({ cart });
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/cart', authenticate, [
    body('restaurantId').isMongoId(),
    body('menuItemId').isMongoId(),
    body('quantity').isInt({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { restaurantId, menuItemId, quantity, specialInstructions } = req.body;

        // Verify restaurant and menu item
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant || !restaurant.isOpen) {
            return res.status(400).json({ message: 'Restaurant not available' });
        }

        const menuItem = restaurant.menu.id(menuItemId);
        if (!menuItem || !menuItem.isAvailable) {
            return res.status(400).json({ message: 'Menu item not available' });
        }

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = new Cart({ 
                user: req.user._id, 
                items: [],
                restaurant: restaurantId
            });
        }

        // Check if cart already has items from different restaurant
        if (cart.restaurant && cart.restaurant.toString() !== restaurantId) {
            return res.status(400).json({ 
                message: 'Cannot add items from different restaurants. Clear cart first.' 
            });
        }

        cart.restaurant = restaurantId;

        // Add or update item in cart
        const existingItemIndex = cart.items.findIndex(
            item => item.menuItem.toString() === menuItemId
        );

        if (existingItemIndex > -1) {
            cart.items[existingItemIndex].quantity += quantity;
            if (specialInstructions) {
                cart.items[existingItemIndex].specialInstructions = specialInstructions;
            }
        } else {
            cart.items.push({
                menuItem: menuItemId,
                quantity,
                specialInstructions,
                price: menuItem.price
            });
        }

        await cart.save();
        await cart.populate('items.menuItem', 'name price image');
        await cart.populate('restaurant', 'name');

        res.json({
            message: 'Item added to cart',
            cart
        });
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/cart/:itemId', authenticate, [
    param('itemId').isMongoId(),
    body('quantity').isInt({ min: 0 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { quantity } = req.body;
        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(
            item => item._id.toString() === req.params.itemId
        );

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        if (quantity === 0) {
            cart.items.splice(itemIndex, 1);
        } else {
            cart.items[itemIndex].quantity = quantity;
        }

        // Clear restaurant if cart is empty
        if (cart.items.length === 0) {
            cart.restaurant = null;
        }

        await cart.save();
        await cart.populate('items.menuItem', 'name price image');
        await cart.populate('restaurant', 'name');

        res.json({
            message: 'Cart updated successfully',
            cart
        });
    } catch (error) {
        console.error('Update cart error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/cart', authenticate, async (req, res) => {
    try {
        await Cart.findOneAndUpdate(
            { user: req.user._id },
            { items: [], restaurant: null }
        );

        res.json({ message: 'Cart cleared successfully' });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Apply coupon
router.post('/cart/apply-coupon', authenticate, [
    body('couponCode').notEmpty().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { couponCode } = req.body;
        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }

        // In production, validate coupon from database
        // For demo, using a simple coupon system
        const validCoupons = {
            'WELCOME10': { discount: 10, type: 'percentage', minOrder: 100 },
            'FIRSTORDER': { discount: 50, type: 'fixed', minOrder: 200 },
            'VARSITH30': { discount: 30, type: 'percentage', minOrder: 150 }
        };

        const coupon = validCoupons[couponCode.toUpperCase()];

        if (!coupon) {
            return res.status(400).json({ message: 'Invalid coupon code' });
        }

        const subtotal = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);

        if (subtotal < coupon.minOrder) {
            return res.status(400).json({ 
                message: `Minimum order amount of ₹${coupon.minOrder} required for this coupon` 
            });
        }

        let discount = 0;
        if (coupon.type === 'percentage') {
            discount = (subtotal * coupon.discount) / 100;
        } else {
            discount = coupon.discount;
        }

        // Cap discount to subtotal
        discount = Math.min(discount, subtotal);

        cart.coupon = {
            code: couponCode.toUpperCase(),
            discount,
            type: coupon.type
        };

        await cart.save();

        res.json({
            message: 'Coupon applied successfully',
            discount,
            cart
        });
    } catch (error) {
        console.error('Apply coupon error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user orders
router.get('/orders', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        
        let query = { user: req.user._id };
        
        if (status) {
            query.status = status;
        }

        const orders = await Order.find(query)
            .populate('restaurant', 'name avatar address')
            .populate('driver', 'firstName lastName phone')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Order.countDocuments(query);

        res.json({
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get order details
router.get('/orders/:id', authenticate, [
    param('id').isMongoId()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const order = await Order.findById(req.params.id)
            .populate('restaurant', 'name avatar address phone')
            .populate('driver', 'firstName lastName phone avatar')
            .populate('user', 'firstName lastName phone address');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user owns this order
        if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({ order });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;