import { Response } from 'express';
import { SettingsModel } from '../models/settings';
import { UserModel } from '../models/user';
import { ReferralController } from './referral';
import { MiningService } from '../services/miningService';
import { LedgerError, ledgerResponse, requestKey } from '../services/ledgerOperations';
import { flushLedgerHistory } from '../services/ledgerHistory';

async function execute(req: any, res: Response, boost = false) {
    try {
        const result = await MiningService.execute(req.user.id, requestKey(req), boost);
        const { referral, ...value } = result.value;
        void flushLedgerHistory().catch(() => {});
        res.json({ ...value, historyPending: result.historyPending, replayed: result.replayed });
        if (!result.replayed && referral) {
            void Promise.resolve(ReferralController.applyReward(referral, req.user.id, 'registration'))
                .catch(() => console.error('Post-mining referral hook failed.'));
        }
    } catch (error) { ledgerResponse(error, res); }
}
export const startMining = (req: any, res: Response) => execute(req, res);
export const claimBoost = (req: any, res: Response) => execute(req, res, true);

async function status(userId: string) {
    const [settings, user, boostReward, boostEnabled, maxBoosts, cycleValue] = await Promise.all([
        SettingsModel.get('mining'), UserModel.findById(userId), SettingsModel.get('boost_reward_amount'),
        SettingsModel.get('boost_enabled'), SettingsModel.get('daily_boost_max'), SettingsModel.get('mining_cycle_hours')
    ]);
    if (!user) throw new LedgerError(404, 'User not found');
    const cycle = Number(cycleValue ?? 24);
    if (!Number.isInteger(cycle) || cycle < 1 || cycle > 8760) throw new LedgerError(503, 'Invalid mining cycle configuration');
    const until = user.last_mined_at ? new Date(user.last_mined_at).getTime() + cycle * 3600000 : 0;
    const timeLeft = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    const blocked = user.is_blocked || user.is_mining_enabled === false || user.mining_paused;
    const dailyReward = Number(settings?.daily_reward ?? 1);
    const currentCycleBoosts = user.current_cycle_boosts ?? 0;
    return {
        canMine: timeLeft === 0 && !!settings?.active && !blocked,
        timeLeft, dailyReward, isGloballyActive: !!settings?.active, userMiningPaused: !!blocked,
        boostReward: Number(boostReward ?? 0.1), boostEnabled: boostEnabled === true || boostEnabled === 'true',
        maxBoosts: Number(maxBoosts ?? 3), currentCycleBoosts,
        currentYield: dailyReward + currentCycleBoosts * Number(boostReward ?? 0.1),
        bonusRate: Number(user.mining_bonus_rate ?? 0)
    };
}
export const getMiningStatus = async (req: any, res: Response) => {
    try { res.json(await status(req.user.id)); } catch (error) { ledgerResponse(error, res); }
};
export const validateMining = async (req: any, res: Response) => {
    try {
        const current = await status(req.user.id);
        if (!current.canMine) return res.status(current.timeLeft > 0 ? 429 : 403)
            .json({ message: current.timeLeft > 0 ? 'Mining session is in cooldown' : 'Mining is disabled', timeLeft: current.timeLeft });
        res.json({ message: 'Validation successful', canProceed: true });
    } catch (error) { ledgerResponse(error, res); }
};
