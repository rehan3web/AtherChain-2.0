/** Durable retries for the backend's internal ledger. No network or browser dependencies. */
export interface PendingOperation<T = Record<string, unknown>> {
    key: string;
    signature: string;
    body: T;
}

interface Storage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export function normalizeAmount(value: unknown): string {
    const text = String(value).trim();
    if (!/^\d+(\.\d{1,8})?$/.test(text)) {
        throw new Error('Enter a positive amount with at most 8 decimal places.');
    }
    const [whole, fraction = ''] = text.split('.');
    const units = BigInt(whole) * BigInt(100000000) + BigInt(fraction.padEnd(8, '0'));
    if (units <= BigInt(0) || units > BigInt('99999999999999999999')) {
        throw new Error('Amount is outside the supported range.');
    }
    const decimals = fraction.replace(/0+$/, '');
    return `${BigInt(whole)}${decimals ? `.${decimals}` : ''}`;
}

function signature(body: Record<string, unknown>) {
    return JSON.stringify(Object.fromEntries(Object.keys(body).sort().map(key => [
        key, key === 'amount' || key === 'amountAT' ? normalizeAmount(body[key]) : body[key]
    ])));
}

export function createFinancialRequests(options: {
    storage: Storage;
    randomUUID: () => string;
    withLock: <T>(name: string, action: () => Promise<T>) => Promise<T>;
}) {
    const active = new Map<string, { signature: string; promise: Promise<unknown> }>();
    const slot = (scope: string, path: string) => `ather_web_pending:${scope}:${path}`;

    function pending<T>(scope: string, path: string): PendingOperation<T> | null {
        const raw = options.storage.getItem(slot(scope, path));
        if (!raw) return null;
        try {
            const record = JSON.parse(raw);
            if (!/^[A-Za-z0-9_-]{16,128}$/.test(record.key) ||
                !record.body || typeof record.body !== 'object' ||
                record.signature !== signature(record.body)) throw new Error();
            return record;
        } catch {
            throw new Error('Saved transaction details could not be read. Do not start another payment; contact support to confirm its result.');
        }
    }

    async function run<T>(scope: string, path: string, body: Record<string, unknown>, send: (key: string) => Promise<T>): Promise<T> {
        const name = slot(scope, path);
        const details = signature(body);
        const completedSlot = `${name}:confirmed`;
        // Snapshot before queuing: two tabs that submit together must not create
        // a fresh operation after the first tab clears its pending request.
        const observedCompletion = options.storage.getItem(completedSlot);
        const inFlight = active.get(name);
        if (inFlight) {
            if (inFlight.signature !== details) throw new Error('Retry the original unconfirmed transaction before changing its details.');
            return inFlight.promise as Promise<T>;
        }
        const promise = options.withLock(name, async () => {
            const latestCompletion = options.storage.getItem(completedSlot);
            if (latestCompletion && latestCompletion !== observedCompletion) {
                const completed = JSON.parse(latestCompletion);
                if (completed.signature !== details) throw new Error('Another transaction just completed. Refresh balances before submitting different details.');
                return completed.result as T;
            }
            const previous = pending(scope, path);
            if (previous && previous.signature !== details) {
                throw new Error('An earlier transaction is unconfirmed. Retry its saved details before starting another.');
            }
            const record = previous ?? { key: options.randomUUID(), signature: details, body };
            const serialized = JSON.stringify(record);
            // Never transmit if durable storage is unavailable.
            options.storage.setItem(name, serialized);
            if (options.storage.getItem(name) !== serialized) throw new Error('Could not save transaction retry details. Nothing was sent.');
            try {
                const result = await send(record.key);
                options.storage.setItem(completedSlot, JSON.stringify({ key: record.key, signature: details, result }));
                options.storage.removeItem(name);
                return result;
            } catch (error) {
                // Auth, proxy, timeout and generic 4xx errors cannot prove non-commit.
                const failure = error as { response?: { data?: { code?: string } } };
                if (failure.response?.data?.code === 'NOT_COMMITTED') options.storage.removeItem(name);
                throw error;
            }
        });
        active.set(name, { signature: details, promise });
        try { return await promise; } finally { active.delete(name); }
    }

    return { pending, run };
}
