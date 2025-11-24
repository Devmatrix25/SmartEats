import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    password: {
        type: String,
        required: function() {
            return !this.googleId; // Password required only for non-Google accounts
        }
    },
    googleId: {
        type: String,
        sparse: true
    },
    avatar: {
        type: String,
        default: null
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
    preferences: {
        cuisine: [String],
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: true },
            push: { type: Boolean, default: true }
        }
    },
    wallet: {
        balance: {
            type: Number,
            default: 0
        },
        transactions: [{
            amount: Number,
            type: {
                type: String,
                enum: ['credit', 'debit']
            },
            description: String,
            date: {
                type: Date,
                default: Date.now
            }
        }]
    },
    role: {
        type: String,
        enum: ['customer', 'driver', 'restaurant', 'admin'],
        default: 'customer'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'address.coordinates': '2dsphere' });

// Password hashing middleware
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    delete user.googleId;
    return user;
};

export default mongoose.model('User', userSchema);