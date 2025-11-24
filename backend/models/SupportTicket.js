// models/SupportTicket.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        enum: ['user', 'support'],
        required: true
    },
    message: {
        type: String,
        required: true
    },
    attachments: [String],
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const supportTicketSchema = new mongoose.Schema({
    ticketNumber: {
        type: String,
        unique: true,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    
    // Ticket details
    subject: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: [
            'order_issue',
            'payment_issue',
            'technical_issue',
            'account_issue',
            'refund_request',
            'suggestion',
            'complaint',
            'other'
        ],
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    
    // Status
    status: {
        type: String,
        enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
        default: 'open'
    },
    
    // Messages
    messages: [messageSchema],
    
    // Resolution
    resolvedAt: Date,
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    resolutionNotes: String,
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

supportTicketSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Generate ticket number
    if (this.isNew) {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.ticketNumber = `TKT${timestamp}${random}`;
    }
    
    next();
});

export default mongoose.model('SupportTicket', supportTicketSchema);