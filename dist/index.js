"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const helmet_1 = __importDefault(require("helmet"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Update CORS for production security
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: '*', // In a production environment, you should list your actual domain here
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
// Health Check for Render zero-downtime deploys and Admin Panel pinging
app.get('/health', (req, res) => {
    const healthData = {
        status: 'ok',
        timestamp: new Date(),
        dbState: mongoose_1.default.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        environment: process.env.NODE_ENV || 'production'
    };
    res.status(200).json(healthData);
});
// Register API Routes
app.use('/api', routes_1.default);
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
mongoose_1.default.connect(MONGODB_URI)
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
