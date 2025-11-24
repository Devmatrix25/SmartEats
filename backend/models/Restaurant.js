import mongoose from 'mongoose';

const menuItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    originalPrice: {
        type: Number,
        min: 0
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        default: null
    },
    ingredients: [String],
    dietaryInfo: {
        isVegetarian: { type: Boolean, default: false },
        isVegan: { type: Boolean, default: false },
        isGlutenFree: { type: Boolean, default: false },
        isSpicy: { type: Boolean, default: false }
    },
    availability: {
        type: Boolean,
        default: true
    },
    preparationTime: {
        type: Number, // in minutes
        default: 15
    },
    tags: [String]
});

const restaurantSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    cuisine: {
        type: [String],
        required: true
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: {
            type: String,
            default: 'India'
        },
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    contact: {
        phone: String,
        email: String
    },
    images: [String],
    logo: String,
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    reviewCount: {
        type: Number,
        default: 0
    },
    deliveryInfo: {
        minOrder: {
            type: Number,
            default: 0
        },
        deliveryFee: {
            type: Number,
            default: 0
        },
        deliveryTime: {
            type: Number, // in minutes
            default: 30
        },
        deliveryRadius: {
            type: Number, // in kilometers
            default: 5
        }
    },
    operatingHours: {
        monday: { open: String, close: String },
        tuesday: { open: String, close: String },
        wednesday: { open: String, close: String },
        thursday: { open: String, close: String },
        friday: { open: String, close: String },
        saturday: { open: String, close: String },
        sunday: { open: String, close: String }
    },
    menu: [menuItemSchema],
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    commissionRate: {
        type: Number,
        default: 15 // percentage
    },
    analytics: {
        totalOrders: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 },
        monthlyRevenue: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

// Indexes
restaurantSchema.index({ name: 'text', description: 'text', cuisine: 'text' });
restaurantSchema.index({ 'address.coordinates': '2dsphere' });
restaurantSchema.index({ rating: -1 });
restaurantSchema.index({ isActive: 1, isVerified: 1 });

// Virtual for isOpen
restaurantSchema.virtual('isOpen').get(function() {
    const now = new Date();
    const day = now.toLocaleLowerCase().substring(0, 3);
    const currentTime = now.toTimeString().substring(0, 5);
    
    const hours = this.operatingHours[day];
    if (!hours || !hours.open || !hours.close) return false;
    
    return currentTime >= hours.open && currentTime <= hours.close;
});

// Method to calculate distance
restaurantSchema.methods.calculateDistance = function(lat, lng) {
    if (!this.address.coordinates) return null;
    
    const R = 6371; // Earth's radius in km
    const dLat = (lat - this.address.coordinates.lat) * Math.PI / 180;
    const dLng = (lng - this.address.coordinates.lng) * Math.PI / 180;
    
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(this.address.coordinates.lat * Math.PI / 180) * 
        Math.cos(lat * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

export default mongoose.model('Restaurant', restaurantSchema);