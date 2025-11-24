import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Driver from '../models/Driver.js';

const socketAuth = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.token;

        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user || !user.isActive) {
            return next(new Error('Authentication error: User not found or inactive'));
        }

        // Attach user information to socket
        socket.userId = user._id.toString();
        socket.userRole = user.role;
        socket.user = user;

        // Additional role-specific data
        if (user.role === 'driver') {
            const driver = await Driver.findOne({ user: user._id });
            if (driver) {
                socket.driverId = driver._id.toString();
            }
        }

        if (user.role === 'restaurant') {
            socket.restaurantId = user.restaurant?.toString();
        }

        next();
    } catch (error) {
        console.error('Socket authentication error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return next(new Error('Authentication error: Invalid token'));
        }
        
        if (error.name === 'TokenExpiredError') {
            return next(new Error('Authentication error: Token expired'));
        }

        next(new Error('Authentication error: Unable to authenticate'));
    }
};

export { socketAuth };