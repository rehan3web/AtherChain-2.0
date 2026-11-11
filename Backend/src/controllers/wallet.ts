import { Request, Response } from 'express';
import pool, { query } from '../db/postgres';
import { WalletService } from '../services/wallet';
import { UserModel } from '../models/user';
import Transaction from '../models/Transaction';
import Claim from '../models/Claim';
import { env } from '../config/env';

export const getWalletStats = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;

        // 1. Fetch User and Wallet from DB
        const userRes = await query(
            `SELECT u.email, u.username, u.at_balance, u.is_transfer_enabled, u.transfer_paused, u.kyc_status, w.address 
             FROM users u 
             JOIN wallets w ON u.id = w.user_id 
             WHERE u.id = $1`,
            [userId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: 'User or wallet not found' });
        }

        const { email, username, at_balance, is_transfer_enabled, transfer_paused, kyc_status, address } = userRes.rows[0];

        // 2. Fetch Global Status
        const transferSettings = await query('SELECT value FROM system_settings WHERE key = $1', ['transfer']);
        const isTransferGlobal = transferSettings.rows[0]?.value?.active !== false;

        // 2. Use DB Balances
        const walletRes = await query('SELECT balance_ath FROM wallets WHERE user_id = $1', [userId]);
        const balanceATH = walletRes.rows[0]?.balance_ath || '0.00';
        const balanceWATH = '0.00'; // Or fetch if balance_wath column added

        res.json({
            email,
            username,
            at_balance: at_balance || '0.00',
            ath_balance: balanceATH,
            wath_balance: balanceWATH,
            wallet_address: address,
            kyc_status: kyc_status,
            is_transfer_enabled: is_transfer_enabled && !transfer_paused && isTransferGlobal,
            transfer_paused: transfer_paused === true,
            is_globally_active: isTransferGlobal
        });

    } catch (error) {
        console.error('getWalletStats error:', error);
        res.status(500).json({ message: 'Failed to fetch wallet stats' });
    }
};

export const sendATH = async (req: Request | any, res: Response) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const { recipient, amount } = req.body;

        if (!recipient || !amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ message: 'Invalid recipient or amount' });
        }

        // 1. Fetch Sender Data
        const senderRes = await client.query(
            `SELECT u.id, u.is_blocked, u.is_transfer_enabled, u.transfer_paused, w.address, w.balance_ath 
             FROM users u 
             JOIN wallets w ON u.id = w.user_id 
             WHERE u.id = $1`,
            [userId]
        );

        const sender = senderRes.rows[0];
        if (!sender) return res.status(404).json({ message: 'Sender not found' });

        if (sender.is_blocked) return res.status(403).json({ message: 'Account is blocked' });

        // Global Protocol Check
        const transferSettings = await client.query('SELECT value FROM system_settings WHERE key = $1', ['transfer']);
        const isTransferGlobal = transferSettings.rows[0]?.value?.active !== false;
        if (!isTransferGlobal) {
            return res.status(403).json({ message: 'Network Protocol Offline: The global transfer system is currently undergoing maintenance.' });
        }

        if (sender.transfer_paused) {
            return res.status(403).json({ message: 'Transfer Access Restricted: Your account transfer protocol has been suspended by administration.' });
        }

        if (!sender.is_transfer_enabled) return res.status(403).json({ message: 'Transfers are disabled for your account' });

        // 2. Resolve Recipient (Internal Only)
        const recipientRes = await client.query(
            `SELECT u.id, w.address FROM users u JOIN wallets w ON u.id = w.user_id 
             WHERE w.address = $1 OR u.email = $1 OR u.username = $1`,
            [recipient]
        );

        if (recipientRes.rows.length === 0) {
            return res.status(400).json({ message: 'You cannot send ATH outside the app (coming soon)' });
        }

        const recipientUser = recipientRes.rows[0];
        if (recipientUser.id === userId) {
            return res.status(400).json({ message: 'Cannot send to yourself' });
        }

        // 3. Atomic Database Transfer
        await client.query('BEGIN');

        const deductRes = await client.query(
            `UPDATE wallets SET balance_ath = balance_ath - $1 
             WHERE user_id = $2 AND balance_ath >= $3 
             RETURNING balance_ath`,
            [amount, userId, amount]
        );

        if (deductRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Insufficient ATH balance' });
        }

        await client.query(
            `UPDATE wallets SET balance_ath = balance_ath + $1 WHERE user_id = $2`,
            [amount, recipientUser.id]
        );

        const txHash = `ATH_TX_${require('uuid').v4().replace(/-/g, '').toUpperCase()}`;

        // 5. Log Transactions to MongoDB
        await Transaction.create({
            userId,
            txHash,
            type: 'send',
            amount: String(amount),
            status: 'completed',
            fromAddress: sender.address,
            toAddress: recipientUser.address,
            fee: '0.00'
        });

        await Transaction.create({
            userId: recipientUser.id,
            txHash: `${txHash}_RCV`,
            type: 'receive',
            amount: String(amount),
            status: 'completed',
            fromAddress: sender.address,
            toAddress: recipientUser.address,
            fee: '0.00'
        });

        await client.query('COMMIT');

        res.json({
            message: 'Transfer successful',
            hash: txHash,
            fee: '0.00'
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('sendATH error:', error);
        res.status(500).json({ message: 'Transfer failed' });
    } finally {
        client.release();
    }
};

export const lookupAddress = async (req: Request | any, res: Response) => {
    try {
        const { identifier } = req.body;
        if (!identifier) return res.status(400).json({ message: 'Identifier required' });

        const resolveRes = await query(
            `SELECT w.address FROM users u JOIN wallets w ON u.id = w.user_id 
             WHERE u.email = $1 OR u.username = $1`,
            [identifier]
        );

        if (resolveRes.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ address: resolveRes.rows[0].address });
    } catch (error) {
        console.error('lookupAddress error:', error);
        res.status(500).json({ message: 'Lookup failed' });
    }
};

// getGasPrice removed

export const requestClaim = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;

        // 1. Fetch User and KYC status
        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.kyc_status !== 'approved') {
            return res.status(403).json({ message: 'Only KYC verified users can claim bridge fee.' });
        }

        // 2. Check if already claimed or pending
        const existingClaim = await Claim.findOne({ userId });
        if (existingClaim) {
            if (existingClaim.status === 'sent') {
                return res.status(400).json({ message: 'You have already claimed your bridge fee.' });
            }
            if (existingClaim.status === 'pending' || existingClaim.status === 'processing') {
                return res.status(400).json({ message: 'Your claim request is already being processed.' });
            }
        }

        // 3. Instant Internal Transfer from Treasury
        const treasuryAddr = WalletService.getTreasuryAddress();
        const tx = await WalletService.transfer(null, userId, '0.1', 'fee_claim', 'ATH');

        // 4. Persistence: Create a claim record to block future requests
        await Claim.create({
            userId,
            walletAddress: user.wallet_address || (await WalletService.getBalance(userId)),
            amount: '0.1',
            txHash: tx.hash,
            status: 'sent'
        });

        res.json({ message: 'Claim successful', txHash: tx.hash, amount: '0.1' });

    } catch (error) {
        console.error('requestClaim error:', error);
        res.status(500).json({ message: 'Failed to request claim' });
    }
};

export const getClaimStatus = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;
        const claim = await Claim.findOne({ userId }).sort({ createdAt: -1 });

        if (!claim) {
            return res.json(null);
        }

        res.json({
            id: claim._id,
            ...claim.toObject()
        });
    } catch (error) {
        console.error('getClaimStatus error:', error);
        res.status(500).json({ message: 'Failed to fetch claim status' });
    }
};


