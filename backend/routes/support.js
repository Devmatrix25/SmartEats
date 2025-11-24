import express from 'express';
import { authenticate } from '../middleware/auth.js';
import SupportTicket from '../models/SupportTicket.js';
import { validationResult, body } from 'express-validator';

const router = express.Router();

// Create support ticket
router.post('/tickets', authenticate, [
    body('subject').notEmpty().trim().escape(),
    body('category').isIn([
        'order_issue',
        'payment_issue',
        'technical_issue',
        'account_issue',
        'refund_request',
        'suggestion',
        'complaint',
        'other'
    ]),
    body('message').notEmpty().trim().escape(),
    body('orderId').optional().isMongoId(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { subject, category, message, orderId, priority = 'medium' } = req.body;

        const ticket = new SupportTicket({
            user: req.user._id,
            order: orderId,
            subject,
            category,
            priority,
            messages: [{
                sender: 'user',
                message
            }]
        });

        await ticket.save();
        await ticket.populate('order', 'orderNumber');

        res.status(201).json({
            message: 'Support ticket created successfully',
            ticket
        });
    } catch (error) {
        console.error('Create ticket error:', error);
        res.status(500).json({ message: 'Error creating support ticket' });
    }
});

// Get user's support tickets
router.get('/tickets', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        
        const filter = { user: req.user._id };
        if (status && status !== 'all') {
            filter.status = status;
        }
        
        const tickets = await SupportTicket.find(filter)
            .populate('order', 'orderNumber')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await SupportTicket.countDocuments(filter);
        
        res.json({
            tickets,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        console.error('Get tickets error:', error);
        res.status(500).json({ message: 'Error fetching support tickets' });
    }
});

// Get single ticket
router.get('/tickets/:ticketId', authenticate, async (req, res) => {
    try {
        const ticket = await SupportTicket.findOne({
            _id: req.params.ticketId,
            user: req.user._id
        }).populate('order', 'orderNumber totalAmount');
        
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        
        res.json(ticket);
    } catch (error) {
        console.error('Get ticket error:', error);
        res.status(500).json({ message: 'Error fetching ticket' });
    }
});

// Add message to ticket
router.post('/tickets/:ticketId/messages', authenticate, [
    body('message').notEmpty().trim().escape()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const ticket = await SupportTicket.findOne({
            _id: req.params.ticketId,
            user: req.user._id
        });

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        if (ticket.status === 'closed') {
            return res.status(400).json({ message: 'Cannot add message to closed ticket' });
        }

        ticket.messages.push({
            sender: 'user',
            message: req.body.message
        });

        ticket.status = 'waiting_customer';
        await ticket.save();

        res.json({ message: 'Message added successfully', ticket });
    } catch (error) {
        console.error('Add message error:', error);
        res.status(500).json({ message: 'Error adding message' });
    }
});

// Close ticket
router.post('/tickets/:ticketId/close', authenticate, async (req, res) => {
    try {
        const ticket = await SupportTicket.findOne({
            _id: req.params.ticketId,
            user: req.user._id
        });

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        ticket.status = 'closed';
        await ticket.save();

        res.json({ message: 'Ticket closed successfully', ticket });
    } catch (error) {
        console.error('Close ticket error:', error);
        res.status(500).json({ message: 'Error closing ticket' });
    }
});

// Get FAQ categories
router.get('/faq', async (req, res) => {
    try {
        const faqCategories = [
            {
                category: 'ordering',
                title: 'Ordering & Payment',
                questions: [
                    {
                        question: 'How do I place an order?',
                        answer: 'Browse restaurants, select items, add to cart, and proceed to checkout. You can pay online or choose cash on delivery.'
                    },
                    {
                        question: 'What payment methods are accepted?',
                        answer: 'We accept credit/debit cards, UPI, net banking, SmartEats Wallet, and cash on delivery.'
                    }
                ]
            },
            {
                category: 'delivery',
                title: 'Delivery & Tracking',
                questions: [
                    {
                        question: 'How long does delivery take?',
                        answer: 'Delivery typically takes 30-45 minutes depending on restaurant preparation time and distance.'
                    },
                    {
                        question: 'Can I track my order?',
                        answer: 'Yes, you can track your order in real-time from the track order page.'
                    }
                ]
            },
            {
                category: 'account',
                title: 'Account & Profile',
                questions: [
                    {
                        question: 'How do I update my profile?',
                        answer: 'Go to your profile page to update personal information, addresses, and preferences.'
                    },
                    {
                        question: 'How do I reset my password?',
                        answer: 'Click "Forgot Password" on the login page and follow the instructions sent to your email.'
                    }
                ]
            }
        ];

        res.json(faqCategories);
    } catch (error) {
        console.error('Get FAQ error:', error);
        res.status(500).json({ message: 'Error fetching FAQ' });
    }
});

export default router;