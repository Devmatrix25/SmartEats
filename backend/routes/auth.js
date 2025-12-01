import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { validationResult, body } from 'express-validator';
import redisClient from '../config/redis.js';
import nodemailer from 'nodemailer';

const router = express.Router();

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,  // your Gmail
        pass: process.env.SMTP_PASS   // App Password
    }
});

// Helper: Send email
async function sendEmail(to, subject, text) {
    try {
        await transporter.sendMail({
            from: `"SmartEats" <${process.env.SMTP_USER}>`,
            to,
            subject,
            text
        });
        return true;
    } catch (err) {
        console.error('Email send error:', err);
        return false;
    }
}

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ClickSend configuration
const CLICKSEND_USERNAME = process.env.CLICKSEND_USERNAME;
const CLICKSEND_API_KEY = process.env.CLICKSEND_API_KEY;
const CLICKSEND_BASE_URL = 'https://rest.clicksend.com/v3';

// Input validation
const registerValidation = [
    body('firstName').notEmpty().trim().escape(),
    body('lastName').notEmpty().trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('phone').isMobilePhone()
];

const loginValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
];

// Register user
router.post('/register', registerValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { firstName, lastName, email, password, phone, role } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user
        const user = new User({
            firstName,
            lastName,
            email,
            password,
            phone,
            role: role || 'customer'
        });

        await user.save();

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store refresh token in Redis
        await redisClient.setEx(`refresh_token:${user._id}`, 7 * 24 * 60 * 60, refreshToken);

        res.status(201).json({
            message: 'User created successfully',
            accessToken,
            refreshToken,
            user: user.toJSON()
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// Login user
router.post('/login', loginValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email, isActive: true });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store refresh token in Redis
        await redisClient.setEx(`refresh_token:${user._id}`, 7 * 24 * 60 * 60, refreshToken);

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        res.json({
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: user.toJSON()
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token required' });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        // Check if refresh token exists in Redis
        const storedToken = await redisClient.get(`refresh_token:${decoded.userId}`);
        if (storedToken !== refreshToken) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        // Get user
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive) {
            return res.status(401).json({ message: 'User not found' });
        }

        // Generate new access token
        const accessToken = generateAccessToken(user);

        res.json({
            accessToken,
            user: user.toJSON()
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({ message: 'Invalid refresh token' });
    }
});

// Logout
router.post('/logout', authenticate, async (req, res) => {
    try {
        // Remove refresh token from Redis
        await redisClient.del(`refresh_token:${req.user._id}`);
        
        res.json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Server error during logout' });
    }
});

// Verify token
router.get('/verify', authenticate, (req, res) => {
    res.json({ user: req.user.toJSON() });
});

// Google OAuth
router.post('/google', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ message: 'Google token required' });
        }

        // Verify Google token
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        
        if (!payload || !payload.email) {
            return res.status(401).json({ message: 'Invalid Google token' });
        }

        let user = await User.findOne({ email: payload.email });
        
        if (!user) {
            // Create new user from Google data
            user = new User({
                firstName: payload.given_name || payload.name.split(' ')[0],
                lastName: payload.family_name || payload.name.split(' ').slice(1).join(' ') || 'User',
                email: payload.email,
                phone: payload.phone || '1234567890', 
                googleId: payload.sub,
                avatar: payload.picture,
                isVerified: payload.email_verified || false
            });
            await user.save();
        } else {
            // Update existing user with Google ID if not already set
            if (!user.googleId) {
                user.googleId = payload.sub;
                user.avatar = payload.picture;
                await user.save();
            }
        }

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        await redisClient.setEx(`refresh_token:${user._id}`, 7 * 24 * 60 * 60, refreshToken);

        res.json({
            message: 'Google authentication successful',
            accessToken,
            refreshToken,
            user: user.toJSON()
        });
    } catch (error) {
        console.error('Google auth error:', error);
        
        if (error.message.includes('Token used too late')) {
            return res.status(401).json({ message: 'Google token has expired' });
        }
        
        res.status(500).json({ message: 'Google authentication failed' });
    }
});

// Helper function to send SMS via ClickSend
async function sendSMS(phoneNumber, message) {
    try {
        const authHeader = Buffer.from(`${CLICKSEND_USERNAME}:${CLICKSEND_API_KEY}`).toString('base64');
        
        const smsData = {
            messages: [
                {
                    body: message,
                    to: phoneNumber,
                    from: process.env.SMS_FROM_NUMBER || 'OTP' // Set default or use env variable
                }
            ]
        };

        const response = await fetch(`${CLICKSEND_BASE_URL}/sms/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(smsData)
        });

        const result = await response.json();
        
        if (result.http_code === 200) {
            return { success: true, data: result };
        } else {
            console.error('ClickSend API error:', result);
            return { success: false, error: result.response_msg || 'Failed to send SMS' };
        }
    } catch (error) {
        console.error('ClickSend SMS error:', error);
        return { success: false, error: error.message };
    }
}

// Send OTP
router.post('/send-otp', [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isMobilePhone(),
    body('type').isIn(['login', 'verification'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, phone, type } = req.body;
        
        if (!email && !phone) {
            return res.status(400).json({ message: 'Email or phone number is required' });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        let identifier;
        let user;

        if (email) {
            // Email OTP flow
            identifier = `email:${email}`;
            user = await User.findOne({ email });
            
            if (!user && type === 'login') {
                return res.status(404).json({ message: 'User not found' });
            }

            // Store OTP in Redis (expires in 10 minutes)
            await redisClient.setEx(`otp:${identifier}`, 600, otp);
            
            const emailSent = await sendEmail(
    email,
    'Your SmartEats OTP Code',
    `Your OTP is ${otp}. It is valid for 10 minutes.`
);

if (!emailSent) {
    return res.status(500).json({ message: 'Failed to send OTP email' });
}

            
        } else if (phone) {
            // SMS OTP flow
            identifier = `phone:${phone}`;
            user = await User.findOne({ phone });
            
            if (!user && type === 'login') {
                return res.status(404).json({ message: 'User not found' });
            }

            // Store OTP in Redis (expires in 10 minutes)
            await redisClient.setEx(`otp:${identifier}`, 600, otp);
            
            // Send SMS via ClickSend
            const message = `Your OTP code is: ${otp}. Valid for 10 minutes.`;
            const smsResult = await sendSMS(phone, message);
            
            if (!smsResult.success) {
                return res.status(500).json({ message: 'Failed to send OTP via SMS', error: smsResult.error });
            }
        }

        res.json({ 
            message: 'OTP sent successfully',
            method: email ? 'email' : 'sms'
        });
    } catch (error) {
        console.error('OTP send error:', error);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
});

// Verify OTP
router.post('/verify-otp', [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isMobilePhone(),
    body('otp').isLength({ min: 6, max: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, phone, otp } = req.body;
        
        if (!email && !phone) {
            return res.status(400).json({ message: 'Email or phone number is required' });
        }

        let identifier;
        let user;

        if (email) {
            identifier = `email:${email}`;
            user = await User.findOne({ email });
        } else {
            identifier = `phone:${phone}`;
            user = await User.findOne({ phone });
        }
        
        // Get stored OTP
        const storedOtp = await redisClient.get(`otp:${identifier}`);
        
        if (!storedOtp || storedOtp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }
        
        // OTP verified
        if (!user) {
            // Create temporary user for OTP login (email required for user creation)
            if (!email) {
                return res.status(400).json({ message: 'Email is required to create a new user' });
            }
            
            user = new User({
                firstName: 'OTP',
                lastName: 'User',
                email,
                phone: phone || null,
                isVerified: true
            });
            await user.save();
        }
        
        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        
        await redisClient.setEx(`refresh_token:${user._id}`, 7 * 24 * 60 * 60, refreshToken);
        
        // Delete used OTP
        await redisClient.del(`otp:${identifier}`);
        
        res.json({
            message: 'OTP verified successfully',
            accessToken,
            refreshToken,
            user: user.toJSON()
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ message: 'OTP verification failed' });
    }
});

// Helper functions
function generateAccessToken(user) {
    const payload = {
        userId: user._id,
        email: user.email,
        role: user.role
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function generateRefreshToken(user) {
    const payload = {
        userId: user._id
    };
    
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}


export default router;

