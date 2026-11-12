import { Request, Response } from 'express';
import Transaction from '../models/Transaction';
import { SettingsModel } from '../models/settings';
import { SwapService } from '../services/swapService';
import { cache } from '../services/cache';
import { ledgerResponse, requestKey } from '../services/ledgerOperations';
import { flushLedgerHistory } from '../services/ledgerHistory';

export const getSwapRate = async (_req: Request, res: Response) => {
    try {
        const settings = await cache.get('swap_settings') || await SettingsModel.get('swap');
        if (settings) await cache.set('swap_settings', settings, 60);
        res.json(settings);
    } catch { res.status(503).json({ message: 'Could not fetch swap settings' }); }
};

export const executeSwap = async (req: any, res: Response) => {
    try {
        const { amountAT, fromToken = 'AT', toToken = 'ATH' } = req.body;
        if (fromToken !== 'AT' || toToken !== 'ATH') return res.status(400).json({ message: 'Invalid swap pair' });
        const result = await SwapService.swapATtoATH(req.user.id, amountAT, requestKey(req));
        void flushLedgerHistory().catch(() => {});
        res.json({ ...result.value, historyPending: result.historyPending, replayed: result.replayed });
    } catch (error) { ledgerResponse(error, res); }
};

export const getSwapStatus = async (req: any, res: Response) => {
    try {
        const lastSwap = await Transaction.findOne({ userId: req.user.id, type: 'swap' }).sort({ createdAt: -1 });
        if (!lastSwap) return res.json(null);
        res.json({
            id: lastSwap._id, status: lastSwap.status.toUpperCase(), txHash: lastSwap.txHash,
            amount: lastSwap.amount, createdAt: lastSwap.createdAt,
            error: lastSwap.status === 'failed' ? lastSwap.metadata?.error : null
        });
    } catch { res.status(503).json({ message: 'Could not fetch swap status' }); }
};
