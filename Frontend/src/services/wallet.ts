import api from '@/lib/api';
import { financialRequest, normalizeRecipient, TransferReceipt } from '@/services/financial';

export interface Transaction {
    id: string;
    type: 'send' | 'receive' | 'mining_reward' | 'swap' | 'deposit' | 'mining'; // types based on common patterns
    amount: string;
    status: 'pending' | 'completed' | 'failed';
    txHash: string;
    timestamp: string;
    fromAddress?: string;
    toAddress?: string;
    recipient?: string; // Sometimes returned as recipient
    fee?: string;
    blockNumber?: string;
    metadata?: any;
}

export interface WalletStats {
    email?: string;
    username?: string;
    at_balance: string;
    ath_balance: string;
    wallet_address: string;
    is_transfer_enabled?: boolean;
    transfer_paused?: boolean;
    is_globally_active?: boolean;
    kyc_status?: string;
}

export interface SendTransactionPayload {
    recipient: string;
    amount: string;
    // If the backend handles lookup internally for 'send', we might just pass the raw input. 
    // But based on "Step 4: Frontend sends identifier... Step 5: Backend returns wallet address", 
    // we likely need a lookup first.
}

export const WalletService = {
    getStats: async (): Promise<WalletStats> => {
        const res = await api.get('/wallet/stats');
        return res.data;
    },

    getTransactions: async (page = 1, limit = 10, search = '') => {
        const res = await api.get('/transactions', {
            params: { page, limit, search }
        });
        return res.data;
    },

    lookupUser: async (identifier: string, type: 'email' | 'username'): Promise<{ address: string }> => {
        const res = await api.post('/wallet/lookup', { identifier: normalizeRecipient(identifier, type) });
        return res.data;
    },

    send: async (payload: { recipient: string; amount: string }) => {
        return financialRequest<TransferReceipt>('/wallet/send', payload);
    }
};
