import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { connectMongo } from './db/mongo';
import pool from './db/postgres';
import redis from './db/redis';

// Routes Imports (Placeholders for now)
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import miningRoutes from './routes/mining';
import swapRoutes from './routes/swap';
import walletRoutes from './routes/wallet';
import referralRoutes from './routes/referral';
import transactionRoutes from './routes/transaction';
import adminRoutes from './routes/admin';
import supportRoutes from './routes/support';
import notificationRoutes from './routes/notifications';
import pushNotificationRoutes from './routes/notification';
import accountDeletionRoutes from './routes/accountDeletion';
import { initNotificationTask } from './tasks/notificationTask';
import marketRoutes from './routes/market';
import MarketBroadcaster from './services/MarketBroadcaster';
import SocketService from './services/SocketService';
import SupportBroadcaster from './services/SupportBroadcaster';
import { ledgerSchema } from './services/ledgerOperations';
import { startLedgerHistoryWorker } from './services/ledgerHistory';

const app = express();

// Middlewares
import { maintenanceCheck } from './middlewares/maintenance';
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
const allowedOrigins = [
    ...env.ALLOWED_ORIGINS,
    ...env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isReplit = /\.replit\.dev$|\.repl\.co$/.test(origin);
        const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
        const isLocalIp = /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin);
        if (isReplit || isLocalhost || isLocalIp || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Idempotency-Key'],
    exposedHeaders: ['Set-Cookie']
}));
app.use(maintenanceCheck); // Maintenance Check before routing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));

// Static Files Serving
import path from 'path';
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes Registration
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/mining', miningRoutes);
app.use('/swap', swapRoutes);
app.use('/wallet', walletRoutes);
app.use('/market', marketRoutes);
app.use('/referral', referralRoutes);
app.use('/transactions', transactionRoutes);
app.use('/admin', adminRoutes);
import newsRoutes from './routes/news';

// ...

app.use('/notifications', notificationRoutes);
app.use('/push-notifications', pushNotificationRoutes);
app.use('/news', newsRoutes);
app.use('/support', supportRoutes);
app.use('/account-deletion', accountDeletionRoutes);
app.use('/api/account-deletion', accountDeletionRoutes);

const startServer = async () => {
    try {
        // 1. Connect MongoDB
        await connectMongo();

        // 2. Check Postgres
        const pgRes = await pool.query('SELECT NOW()');
        console.log('✅ Connected to PostgreSQL:', pgRes.rows[0].now);
        // Additive, isolated schema initialization; never run the legacy setup/reset scripts.
        await pool.query(ledgerSchema);
        startLedgerHistoryWorker();

        // 3. Check Redis (It connects automatically on instantiation, but we can ping)
        await redis.ping();
        console.log('✅ Connected to Redis (Ping successful)');

        const server = app.listen(Number(env.PORT) || 5001, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
        });

        const io = SocketService.init(server);
        MarketBroadcaster.init();
        SupportBroadcaster.init(io);

        // Initialize Background Tasks
        initNotificationTask();

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
