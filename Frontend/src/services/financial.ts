import api from '@/lib/api';
import { createFinancialRequests, normalizeAmount, PendingOperation } from '@/lib/financialRequests';

export type FinancialPath = '/wallet/send' | '/swap/execute' | '/mining/start' | '/mining/claim-boost';
export interface LedgerReceipt { historyPending?: boolean; replayed?: boolean }
export interface TransferReceipt extends LedgerReceipt { success: true; hash: string; fee: string }
export interface SwapReceipt extends LedgerReceipt {
    success: true;
    status: 'completed';
    hash: string;
    txId: string;
    receipt: { fromAmount: number; toAmount: number; rate: number; createdAt: string };
}
export interface MiningReceipt extends LedgerReceipt { reward: number; newBalance: number; message: string }
export interface BoostReceipt extends LedgerReceipt { boostReward: number; currentCycleBoosts: number; message: string }
export type FinancialBody = Record<string, unknown>;

let manager: ReturnType<typeof createFinancialRequests> | undefined;
function requests() {
    if (typeof window === 'undefined') throw new Error('Financial requests require a browser.');
    return manager ??= createFinancialRequests({
        storage: window.localStorage,
        randomUUID: () => crypto.randomUUID(),
        withLock: async (name, action) => {
            if (!navigator.locks) throw new Error('This browser cannot safely coordinate payments. Use an up-to-date browser over HTTPS.');
            return await navigator.locks.request(name, async () => await action());
        }
    });
}

async function session() {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Sign in again to retry your saved transaction.');
    let identity = token;
    try {
        const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
        identity = String(claims.id ?? claims.userId ?? claims.sub ?? token);
    } catch { /* Opaque sessions use a non-reversible token scope. */ }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
    const scope = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return { token, scope };
}

export function normalizeRecipient(identifier: string, type?: 'email' | 'username') {
    const trimmed = identifier.trim();
    return type === 'username' ? trimmed.replace(/^@/, '') : trimmed;
}

export async function getPendingFinancialRequest<T extends FinancialBody>(path: FinancialPath): Promise<PendingOperation<T> | null> {
    const { scope } = await session();
    return requests().pending<T>(scope, path);
}

function validReceipt(path: FinancialPath, data: Record<string, any>) {
    if (!data || typeof data !== 'object') return false;
    if (path === '/wallet/send') return data.success === true && typeof data.hash === 'string' && data.hash.startsWith('ATH_TX_');
    if (path === '/swap/execute') return data.success === true && data.status === 'completed' &&
        typeof data.hash === 'string' && data.hash.startsWith('ATH_SWAP_') &&
        Number.isFinite(data.receipt?.fromAmount) && data.receipt.fromAmount > 0 &&
        Number.isFinite(data.receipt?.toAmount) && data.receipt.toAmount > 0;
    if (path === '/mining/start') return Number.isFinite(data.reward) && data.reward > 0 && Number.isFinite(data.newBalance);
    return Number.isFinite(data.boostReward) && Number.isInteger(data.currentCycleBoosts) && data.currentCycleBoosts > 0;
}

export async function financialRequest<T>(path: FinancialPath, body: FinancialBody = {}): Promise<T> {
    const { token, scope } = await session();
    const normalized = { ...body };
    for (const field of ['amount', 'amountAT']) {
        if (normalized[field] !== undefined) normalized[field] = normalizeAmount(normalized[field]);
    }
    return requests().run(scope, path, normalized, async key => {
        const response = await api.post(path, normalized, {
            headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key },
            timeout: 30000
        });
        if (!validReceipt(path, response.data)) throw new Error('The server did not return a valid receipt. Retry the saved transaction to confirm its result.');
        return response.data as T;
    });
}

export function financialError(error: unknown) {
    const failure = error as { message?: string; response?: { data?: { message?: string; code?: string } } };
    const message = failure.response?.data?.message || failure.message || 'Request failed.';
    return failure.response?.data?.code === 'NOT_COMMITTED'
        ? message
        : `${message} If the result is unconfirmed, use “Retry saved transaction”; do not create another payment.`;
}
