import { Request, Response } from 'express';
import { query } from '../db/postgres';
import redis from '../db/redis';
import { WalletService } from '../services/wallet';
import pool from '../db/postgres';
import { AuditService } from '../services/audit';
import bcrypt from 'bcryptjs';
import Transaction from '../models/Transaction';

export const listUsers = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;

    try {
        let sql = `
            SELECT u.id, u.username, u.email, u.kyc_status, u.is_blocked, u.is_swap_enabled, u.created_at,
                   u.at_balance, w.balance_ath, w.address as wallet_address
            FROM users u
            LEFT JOIN wallets w ON u.id = w.user_id
        `;
        const params: any[] = [limit, offset];

        if (search) {
            sql += ` WHERE u.username ILIKE $3 OR u.email ILIKE $3 OR w.address ILIKE $3`;
            params.push(search);
        }

        sql += ` ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`;

        const result = await query(sql, params);

        // Count total
        let countSql = `SELECT COUNT(*) FROM users u LEFT JOIN wallets w ON u.id = w.user_id`;
        const countParams = [];
        if (search) {
            countSql += ` WHERE u.username ILIKE $1 OR u.email ILIKE $1 OR w.address ILIKE $1`;
            countParams.push(search);
        }
        const countRes = await query(countSql, countParams);

        res.json({
            users: result.rows,
            pagination: {
                total: parseInt(countRes.rows[0].count),
                page,
                pages: Math.ceil(parseInt(countRes.rows[0].count) / limit)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

export const getUserDetails = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        const userRes = await query(
            `SELECT u.*, w.balance_at, w.balance_ath, w.address as wallet_address
             FROM users u
             LEFT JOIN wallets w ON u.id = w.user_id
             WHERE u.id = $1`,
            [userId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const user = userRes.rows[0];

        // 2. Referral Tree
        const referralsRes = await query(
            `SELECT id, username, email, kyc_status, created_at 
             FROM users 
             WHERE referred_by = $1 
             ORDER BY created_at DESC`,
            [user.id]
        );

        // 3. Stats Calculation
        const earningsRes = await query(
            `SELECT SUM(amount) as total_earned FROM referral_rewards_log WHERE referrer_id = $1`,
            [user.id]
        );
        const totalEarned = parseFloat(earningsRes.rows[0].total_earned) || 0;

        res.json({
            user,
            referrals: referralsRes.rows,
            stats: {
                totalReferrals: referralsRes.rows.length,
                totalEarned
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching details' });
    }
};

export const updateUserStatus = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { is_blocked, mining_paused, swap_paused, transfer_paused, is_swap_enabled, block_reason } = req.body;

    try {
        const updates: string[] = [];
        const values: any[] = [];
        let i = 1;

        if (is_blocked !== undefined) { updates.push(`is_blocked = $${i++}`); values.push(is_blocked); }
        if (mining_paused !== undefined) {
            updates.push(`mining_paused = $${i++}`); values.push(mining_paused);
            updates.push(`is_mining_enabled = $${i++}`); values.push(!mining_paused);
        }
        if (swap_paused !== undefined) {
            updates.push(`swap_paused = $${i++}`); values.push(swap_paused);
            updates.push(`is_swap_enabled = $${i++}`); values.push(!swap_paused);
        }
        if (transfer_paused !== undefined) {
            updates.push(`transfer_paused = $${i++}`); values.push(transfer_paused);
            updates.push(`is_transfer_enabled = $${i++}`); values.push(!transfer_paused);
        }
        if (is_swap_enabled !== undefined) { updates.push(`is_swap_enabled = $${i++}`); values.push(is_swap_enabled); }
        if (block_reason !== undefined) { updates.push(`block_reason = $${i++}`); values.push(block_reason); }
        if (req.body.kyc_status !== undefined) { updates.push(`kyc_status = $${i++}`); values.push(req.body.kyc_status); }

        if (updates.length === 0) return res.status(400).json({ message: 'No updates provided' });

        values.push(userId);

        await query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`,
            values
        );

        if (is_blocked === true) {
            await redis.del(`session:${userId}`);
        }

        res.json({ message: 'User updated' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Update failed' });
    }
};

export const updateUserBalance = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { type, amount, action } = req.body; // type: 'AT' | 'ATH', action: 'add' | 'deduct'
    const adminId = (req as any).user?.id || 'SYSTEM';

    if (!['AT', 'ATH'].includes(type) || !['add', 'deduct'].includes(action)) {
        return res.status(400).json({ message: 'Invalid params' });
    }

    try {
        let txHash: string;

        if (type === 'ATH') {
            const treasuryAddr = WalletService.getTreasuryAddress();
            if (action === 'add') {
                // Technically we need a system "user" ID for treasury if we use WalletService.transfer
                // Or we do a direct DB update and log it.
                // Let's use a specialized method for administrative adjustments.
                const res = await WalletService.transfer(null, String(userId), amount, 'admin_adjustment', 'ATH');
                txHash = res.hash;
            } else {
                const res = await WalletService.transfer(String(userId), treasuryAddr, amount, 'admin_adjustment', 'ATH');
                txHash = res.hash;
            }
        } else {
            // AT Balance remains DB-only
            const operator = action === 'add' ? '+' : '-';
            await query(`UPDATE users SET at_balance = at_balance ${operator} $1 WHERE id = $2`, [amount, userId]);
            txHash = `ADMIN_ADJUST_${Date.now()}`;
        }

        await AuditService.log(String(adminId), String(userId), action === 'add' ? 'ADMIN_DEPOSIT' : 'ADMIN_WITHDRAWAL', {
            asset: type,
            amount,
            txHash
        });

        res.json({
            message: `Balance ${action === 'add' ? 'increased' : 'decreased'} successfully`,
            txHash
        });

    } catch (error: any) {
        console.error('[ADMIN_BALANCE_ADJUST_ERROR]', error);
        res.status(500).json({ message: error.message || 'Adjustment failed' });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    const userId = req.params.userId;
    const adminId = (req as any).user.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE users SET referred_by = NULL WHERE referred_by = $1`, [userId]);
        await client.query(`DELETE FROM referral_rewards_log WHERE referrer_id = $1 OR referred_id = $1`, [userId]);
        await client.query(`DELETE FROM kyc_requests WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM wallets WHERE user_id = $1`, [userId]);
        const deleteRes = await client.query(`DELETE FROM users WHERE id = $1 RETURNING email`, [userId]);
        if (deleteRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User not found' });
        }
        await redis.del(`session:${userId}`);
        await AuditService.log(String(adminId), String(userId), 'DELETE_USER', { message: 'Permanently deleting user' });
        await client.query('COMMIT');
        res.json({ message: 'User permanently deleted' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to delete user' });
    } finally {
        client.release();
    }
};

export const adminSendAssets = async (req: Request, res: Response) => {
    const { userId } = req.params; // Source User
    const { recipient, amount, asset = 'ATH' } = req.body;
    const adminId = (req as any).user.id;

    try {
        if (asset !== 'ATH') return res.status(400).json({ message: 'Only internal ATH transfers are supported.' });
        const txResult = await WalletService.transfer(String(userId), String(recipient), amount, 'admin_transfer', asset);

        await AuditService.log(String(adminId), String(userId), 'ADMIN_TRANSFER_FROM_USER', {
            recipient,
            amount,
            asset,
            txHash: txResult.hash
        });

        res.json({
            message: 'Transfer executed successfully',
            txHash: txResult.hash
        });
    } catch (error: any) {
        console.error('Admin Transfer Error:', error);
        res.status(500).json({ message: error.message || 'Transfer failed' });
    }
};

export const recreateUserWallet = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const adminId = (req as any).user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM wallets WHERE user_id = $1', [userId]);
        const { address } = await WalletService.createWallet();
        await client.query(
            `INSERT INTO wallets (user_id, address, balance_at, balance_ath)
             VALUES ($1, $2, 0, 0)`,
            [userId, address]
        );
        await AuditService.log(String(adminId), String(userId), 'RECREATE_WALLET', { newAddress: address });
        await client.query('COMMIT');
        res.json({ message: 'Wallet recreated successfully', address });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to recreate wallet' });
    } finally {
        client.release();
    }
};

export const getUserTransactions = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = (req.query.search as string || '').trim();

        const queryObj: any = { userId };
        if (search) queryObj.txHash = { $regex: search, $options: 'i' };

        const totalCount = await Transaction.countDocuments(queryObj);
        const txs = await Transaction.find(queryObj)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            data: txs,
            meta: {
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                totalCount
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching transactions' });
    }
};

export const editUser = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { username, email, kyc_status } = req.body;
    try {
        await query(
            `UPDATE users SET username = $1, email = $2, kyc_status = $3 WHERE id = $4`,
            [username, email, kyc_status, userId]
        );
        res.json({ message: 'User profile updated' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update user' });
    }
};

export const resetUserPassword = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashedPassword, userId]);
        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to reset password' });
    }
};

export const forceLogoutUser = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        await redis.del(`session:${userId}`);
        res.json({ message: 'User logged out' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to logout user' });
    }
};
