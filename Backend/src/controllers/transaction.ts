import { Request, Response } from 'express';
import { query } from '../db/postgres';
import Transaction from '../models/Transaction';

export const getTransactions = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = (req.query.search as string || '').trim();

        // 1. Fetch user's wallet address from Postgres (optional, but kept for consistency if needed)
        // const userRes = await query('SELECT address FROM wallets WHERE user_id = $1', [userId]);
        // if (userRes.rows.length === 0) {
        //     return res.json({ data: [], meta: { totalPages: 0, currentPage: page, totalCount: 0 } });
        // }

        // 2. Build Query
        const queryObj: any = { userId };
        if (search) {
            queryObj.txHash = { $regex: search, $options: 'i' };
        }

        // 3. Fetch from MongoDB with pagination
        const totalCount = await Transaction.countDocuments(queryObj);
        const totalPages = Math.ceil(totalCount / limit);

        const txs = await Transaction.find(queryObj)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        // Map to JSON friendly format
        const transactions = txs.map(row => ({
            id: row._id,
            timestamp: row.createdAt,
            txHash: row.txHash,
            type: row.type,
            amount: row.amount,
            status: row.status,
            fromAddress: row.fromAddress,
            toAddress: row.toAddress,
            fee: row.fee,
            metadata: row.metadata
        }));

        res.json({
            data: transactions,
            meta: {
                totalPages,
                currentPage: page,
                totalCount
            }
        });

    } catch (error) {
        console.error('Transaction Fetch Error:', error);
        res.status(500).json({ message: 'Failed to fetch transaction history. Please try again.' });
    }
};
