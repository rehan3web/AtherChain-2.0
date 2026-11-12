import { Request, Response } from 'express';
import { query } from '../db/postgres';
import { WalletService } from '../services/wallet';
import { ledgerResponse, requestKey } from '../services/ledgerOperations';
import { flushLedgerHistory } from '../services/ledgerHistory';

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

        res.json({
            email,
            username,
            at_balance: at_balance || '0.00',
            ath_balance: balanceATH,
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
    try {
        const { recipient, amount } = req.body;
        if (typeof recipient !== 'string' || !recipient.trim()) return res.status(400).json({ message: 'Recipient required' });
        const result = await WalletService.transfer(req.user.id, recipient, amount, 'send', 'ATH', requestKey(req));
        void flushLedgerHistory().catch(() => {});
        res.json(result);
    } catch (error) { ledgerResponse(error, res); }
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
