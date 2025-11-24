import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
    menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant.menu',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    image: String,
    description: String,
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    specialInstructions: String
});

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant'
    },
    items: [cartItemSchema],
    appliedCoupon: {
        code: String,
        discount: Number,
        discountType: {
            type: String,
            enum: ['percentage', 'fixed']
        }
    }
}, {
    timestamps: true
});

// Indexes
cartSchema.index({ user: 1 });
cartSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // Auto-delete after 30 days

// Virtual for total items count
cartSchema.virtual('itemCount').get(function() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for total price
cartSchema.virtual('totalPrice').get(function() {
    return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
});

// Method to calculate delivery fee
cartSchema.methods.getDeliveryFee = function() {
    if (!this.restaurant) return 0;
    return this.populate('restaurant').then(cart => {
        return cart.restaurant.deliveryInfo.deliveryFee || 0;
    });
};

// Method to calculate tax
cartSchema.methods.getTax = function() {
    return this.totalPrice * 0.05; // 5% tax
};

// Method to calculate grand total
cartSchema.methods.getGrandTotal = function() {
    const subtotal = this.totalPrice;
    const deliveryFee = this.getDeliveryFee();
    const tax = this.getTax();
    const discount = this.appliedCoupon ? 
        (this.appliedCoupon.discountType === 'percentage' ? 
            subtotal * (this.appliedCoupon.discount / 100) : 
            this.appliedCoupon.discount) : 0;
    
    return subtotal + deliveryFee + tax - discount;
};

// Static method to get cart by user ID
cartSchema.statics.findByUserId = function(userId) {
    return this.findOne({ user: userId })
        .populate('restaurant', 'name images deliveryInfo');
};

export default mongoose.model('Cart', cartSchema);