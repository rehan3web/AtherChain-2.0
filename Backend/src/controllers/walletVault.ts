import { Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../db/postgres';

export const getVaultPepper = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;
        const existing = await pool.query(
            'SELECT pepper FROM wallet_vault_peppers WHERE user_id = $1',
            [userId]
        );

        if (existing.rows.length > 0) {
            return res.json({ pepper: existing.rows[0].pepper });
        }

        const newPepper = crypto.randomBytes(32).toString('hex');
        await pool.query(
            'INSERT INTO wallet_vault_peppers (user_id, pepper) VALUES ($1, $2)',
            [userId, newPepper]
        );

        return res.json({ pepper: newPepper });
    } catch (error) {
        console.error('getVaultPepper error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getVault = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT envelope FROM wallet_vaults WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Vault not found' });
        }

        return res.json({ envelope: result.rows[0].envelope });
    } catch (error) {
        console.error('getVault error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const putVault = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;
        const { envelope } = req.body;

        if (!envelope) {
            return res.status(400).json({ message: 'Envelope payload required' });
        }

        await pool.query(
            `INSERT INTO wallet_vaults (user_id, envelope, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id) DO UPDATE SET envelope = $2, updated_at = NOW()`,
            [userId, JSON.stringify(envelope)]
        );

        return res.json({ message: 'Vault saved successfully' });
    } catch (error) {
        console.error('putVault error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteVault = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;
        await pool.query('DELETE FROM wallet_vaults WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM wallet_vault_peppers WHERE user_id = $1', [userId]);

        return res.json({ message: 'Vault deleted successfully' });
    } catch (error) {
        console.error('deleteVault error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

