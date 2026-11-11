import api from '@/lib/api';

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
    wath_balance: string;
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
        // Assuming backend endpoint for lookup. 
        // If it doesn't exist, I will have to rely on the user to provide it or maybe '/wallet/lookup' is the standard.
        // I'll try '/wallet/lookup'.
        const res = await api.post('/wallet/lookup', { identifier, type });
        return res.data;
    },

    getGasPrice: async (): Promise<string> => {
        const res = await api.get('/wallet/gas-price');
        return res.data.price;
    },

    send: async (payload: { recipient: string; amount: string }) => {
        const res = await api.post('/wallet/send', payload);
        return res.data;
    },

    requestClaim: async () => {
        const res = await api.post('/wallet/claim');
        return res.data;
    },

    getClaimStatus: async () => {
        const res = await api.get('/wallet/claim-status');
        return res.data;
    }
};
