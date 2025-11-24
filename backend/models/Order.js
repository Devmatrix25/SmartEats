import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant.menu'
    },
    name: String,
    price: Number,
    quantity: Number,
    specialInstructions: String,
    total: Number
});

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        unique: true,
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    items: [orderItemSchema],
    orderTotal: {
        type: Number,
        required: true
    },
    deliveryFee: {
        type: Number,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
    deliveryAddress: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    status: {
        type: String,
        enum: [
            'pending',
            'confirmed',
            'preparing',
            'ready',
            'picked_up',
            'on_the_way',
            'delivered',
            'cancelled',
            'rejected'
        ],
        default: 'pending'
    },
    statusHistory: [{
        status: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        note: String
    }],
    payment: {
        method: {
            type: String,
            enum: ['card', 'upi', 'wallet', 'cash'],
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending'
        },
        transactionId: String,
        paymentIntentId: String
    },
    preparationTime: {
        type: Number, // in minutes
        default: 20
    },
    deliveryTime: {
        type: Number, // in minutes
        default: 30
    },
    scheduledFor: {
        type: Date // for scheduled orders
    },
    specialInstructions: String,
    rating: {
        restaurant: {
            value: { type: Number, min: 1, max: 5 },
            comment: String
        },
        driver: {
            value: { type: Number, min: 1, max: 5 },
            comment: String
        }
    },
    coupons: [{
        code: String,
        discount: Number
    }],
    tracking: {
        driverLocation: {
            lat: Number,
            lng: Number,
            timestamp: Date
        },
        estimatedDelivery: Date
    }
}, {
    timestamps: true
});

// Indexes
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, createdAt: -1 });
orderSchema.index({ driver: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderId: 1 });

// Pre-save middleware to generate order ID and update status history
orderSchema.pre('save', function(next) {
    if (this.isNew) {
        // Generate order ID: SE + timestamp + random string
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 6);
        this.orderId = `SE${timestamp}${random}`.toUpperCase();
        
        // Add initial status to history
        this.statusHistory.push({
            status: this.status,
            note: 'Order placed'
        });
    }
    
    // Update status history when status changes
    if (this.isModified('status') && !this.isNew) {
        this.statusHistory.push({
            status: this.status,
            note: 'Status updated'
        });
    }
    
    next();
});

// Method to calculate ETA
orderSchema.methods.calculateETA = function() {
    const now = new Date();
    let eta = new Date(now);
    
    switch (this.status) {
        case 'pending':
        case 'confirmed':
            eta.setMinutes(eta.getMinutes() + this.preparationTime + this.deliveryTime);
            break;
        case 'preparing':
            eta.setMinutes(eta.getMinutes() + this.preparationTime + this.deliveryTime - 10);
            break;
        case 'ready':
            eta.setMinutes(eta.getMinutes() + this.deliveryTime);
            break;
        case 'picked_up':
        case 'on_the_way':
            eta.setMinutes(eta.getMinutes() + 15); // Approximate delivery time
            break;
        default:
            eta = null;
    }
    
    return eta;
};

// Static method to get orders by status
orderSchema.statics.findByStatus = function(status) {
    return this.find({ status }).populate('customer restaurant driver');
};

export default mongoose.model('Order', orderSchema);