import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import router from './routes';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Update CORS for production security
app.use(cors({
    origin: '*', // In a production environment, you should list your actual domain here
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}) as any);

app.use(express.json() as any);

// Health Check for Render zero-downtime deploys and Admin Panel pinging
app.get('/health', (req, res) => {
    const healthData = { 
        status: 'ok', 
        timestamp: new Date(), 
        dbState: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        environment: process.env.NODE_ENV || 'production' 
    };
    res.status(200).json(healthData);
});

// Register API Routes
app.use('/api', router);

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ FATAL: MONGODB_URI is not defined. Platform cannot initialize.');
    process.exit(1);
}

// Track unhandled rejections to prevent silent node crashes
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Operational: MongoDB Atlas Connected');
    app.listen(PORT, () => {
      console.log(`🚀 Edumeet Production Node running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Database Initialization Error:', err);
    process.exit(1);
  });