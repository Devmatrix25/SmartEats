import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Restaurant from '../models/Restaurant.js';
import Cart from '../models/Cart.js';

const router = express.Router();

// Get user's cart
router.get('/', authenticate, async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id })
            .populate('restaurant', 'name images deliveryInfo');
        
        if (!cart) {
            cart = new Cart({
                user: req.user._id,
                items: [],
                restaurant: null
            });
            await cart.save();
        }
        
        res.json(cart);
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ message: 'Error fetching cart' });
    }
});

// Update cart
router.post('/', authenticate, async (req, res) => {
    try {
        const { items, restaurant } = req.body;
        
        let cart = await Cart.findOne({ user: req.user._id });
        
        if (!cart) {
            cart = new Cart({
                user: req.user._id,
                items: [],
                restaurant: null
            });
        }
        
        // Validate restaurant consistency
        if (restaurant && cart.restaurant && cart.restaurant.toString() !== restaurant._id) {
            return res.status(400).json({ 
                message: 'Cannot add items from different restaurants. Clear your cart first.' 
            });
        }
        
        cart.items = items;
        cart.restaurant = restaurant ? restaurant._id : null;
        cart.updatedAt = new Date();
        
        await cart.save();
        
        await cart.populate('restaurant', 'name images deliveryInfo');
        
        res.json({
            message: 'Cart updated successfully',
            cart
        });
    } catch (error) {
        console.error('Update cart error:', error);
        res.status(500).json({ message: 'Error updating cart' });
    }
});

// Add item to cart
router.post('/add', authenticate, async (req, res) => {
    try {
        const { menuItemId, restaurantId, quantity = 1 } = req.body;
        
        // Get restaurant and menu item
        const restaurant = await Restaurant.findById(restaurantId);
        
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        
        const menuItem = restaurant.menu.id(menuItemId);
        if (!menuItem) {
    return res.status(404).json({ message: 'Menu item not found' });
}

if (menuItem.availability === false) {
    return res.status(404).json({ message: 'Menu item not available' });
}
        
        let cart = await Cart.findOne({ user: req.user._id });
        
        if (!cart) {
            cart = new Cart({
                user: req.user._id,
                items: [],
                restaurant: restaurantId
            });
        }
        
        // Check if adding from different restaurant
        if (cart.restaurant && cart.restaurant.toString() !== restaurantId) {
            return res.status(400).json({ 
                message: 'Cannot add items from different restaurants. Clear your cart first.' 
            });
        }
        
        // Update or add item
        const existingItemIndex = cart.items.findIndex(
            item => item.menuItem.toString() === menuItemId
        );
        
        if (existingItemIndex > -1) {
            cart.items[existingItemIndex].quantity += quantity;
        } else {
            cart.items.push({
                menuItem: menuItemId,
                name: menuItem.name,
                price: menuItem.price,
                image: menuItem.image,
                description: menuItem.description,
                quantity
            });
        }
        
        cart.restaurant = restaurantId;
        cart.updatedAt = new Date();
        
        await cart.save();
        await cart.populate('restaurant', 'name images deliveryInfo');
        
        res.json({
            message: 'Item added to cart',
            cart
        });
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ message: 'Error adding item to cart' });
    }
});

// Remove item from cart
router.delete('/item/:itemId', authenticate, async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }
        
        cart.items = cart.items.filter(
            item => item._id.toString() !== req.params.itemId
        );
        
        // If cart is empty, clear restaurant
        if (cart.items.length === 0) {
            cart.restaurant = null;
        }
        
        cart.updatedAt = new Date();
        await cart.save();
        
        await cart.populate('restaurant', 'name images deliveryInfo');
        
        res.json({
            message: 'Item removed from cart',
            cart
        });
    } catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ message: 'Error removing item from cart' });
    }
});

// Clear cart
router.delete('/clear', authenticate, async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }
        
        cart.items = [];
        cart.restaurant = null;
        cart.updatedAt = new Date();
        
        await cart.save();
        
        res.json({
            message: 'Cart cleared successfully',
            cart
        });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ message: 'Error clearing cart' });
    }
});

export default router;