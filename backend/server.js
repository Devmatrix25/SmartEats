import express from 'express';
import mongoose from 'mongoose';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import restaurantRoutes from './routes/restaurants.js';
import orderRoutes from './routes/orders.js';
import driverRoutes from './routes/drivers.js';
import adminRoutes from './routes/admin.js';
import cartRoutes from './routes/cart.js';
import paymentRoutes from './routes/payments.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';
import { socketAuth } from './middleware/socketAuth.js';

// Import models
import './models/User.js';
import './models/Restaurant.js';
import './models/Order.js';
import './models/Driver.js';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smarteats';

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(helmet());
app.use(limiter);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Socket.IO connection handling
io.use(socketAuth);

io.on('connection', (socket) => {
    console.log('User connected:', socket.userId);
    
    // Join user to their personal room
    socket.join(socket.userId);
    
    // Join driver to driver room if applicable
    if (socket.userRole === 'driver') {
        socket.join('drivers');
    }
    
    // Join restaurant to restaurant room if applicable
    if (socket.userRole === 'restaurant') {
        socket.join(`restaurant:${socket.restaurantId}`);
    }

    // Order updates
    socket.on('order:update', (data) => {
        // Broadcast order updates to relevant users
        socket.to(data.orderId).emit('order:status', data);
    });

    // Driver location updates
    socket.on('driver:location', (data) => {
        // Broadcast driver location to order owner
        socket.to(data.orderId).emit('location:update', data);
    });

    // Order assignment
    socket.on('order:assign', (data) => {
        // Notify available drivers
        socket.to('drivers').emit('order:request', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.userId);
    });
});

// Error handling
app.use(errorHandler);

// Database connection
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        mongoose.connection.close();
        process.exit(0);
    });
});

export { io };