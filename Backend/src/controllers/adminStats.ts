import { Request, Response } from 'express';
import { query } from '../db/postgres';
import Transaction from '../models/Transaction';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        // 1. Postgres Data: Users & Balances
        const userStats = await query(`
            SELECT 
                COUNT(*) as total_users,
                (SELECT COUNT(*) FROM users WHERE kyc_status = 'approved') as active_users,
                (SELECT SUM(at_balance) FROM users) as total_mined
            FROM users
        `);

        // 2. Recent Registrations
        const recentUsers = await query(`
            SELECT username, created_at, kyc_status 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        // 3. Recent Swaps (MongoDB)
        const recentSwaps = await Transaction.find({ type: 'swap' })
            .sort({ createdAt: -1 })
            .limit(5);

        // Calculate volume for the last 50 swaps for a better estimate
        const volumeSwaps = await Transaction.find({ type: 'swap' })
            .sort({ createdAt: -1 })
            .limit(50);

        const swapVolume = volumeSwaps.reduce((acc, tx) => acc + parseFloat(tx.amount || '0'), 0);

        // 3. User Growth (Daily Signups) - Last 30 Days
        const dailySignups = await query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM users
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC
        `);

        // 4. Country Distribution
        const countryStats = await query(`
            SELECT country, COUNT(*) as count
            FROM users
            WHERE country IS NOT NULL
            GROUP BY country
            ORDER BY count DESC
        `);

        // Calculate percentages for countries
        const totalWithCountry = countryStats.rows.reduce((acc: number, row: any) => acc + parseInt(row.count), 0);
        const countryDistribution = countryStats.rows.map((row: any) => ({
            name: row.country,
            value: parseInt(row.count),
            fill: '' // Frontend will assign colors
        }));

        const totalUsers = parseInt(userStats.rows[0].total_users);
        const activeMiners = parseInt(userStats.rows[0].active_users);
        const totalMined = parseFloat(userStats.rows[0].total_mined || '0');

        const userGrowth = dailySignups.rows.map((row: any) => ({
            date: row.date,
            count: parseInt(row.count)
        }));

        res.json({
            totalUsers,
            activeMiners,
            totalMined,
            swapVolume,
            recentUsers: recentUsers.rows,
            recentSwaps,                       // NEW
            userGrowth,                        // NEW
            countryDistribution,               // NEW
            // serverLoad removed as requested
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Stats error' });
    }
};

export const getSwapHistory = async (req: Request, res: Response) => {
    try {
        // Fetch recent swaps from MongoDB
        const swaps = await Transaction.find({ type: 'swap' })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            logs: swaps
        });
    } catch (error) {
        console.error('Swap History Error:', error);
        res.status(500).json({ message: 'Error fetching swap logs' });
    }
};
