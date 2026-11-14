'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { PendingOperation } from '@/lib/financialRequests';
import { FinancialBody, FinancialPath, financialRequest, getPendingFinancialRequest } from '@/services/financial';

export function useFinancialOperation<B extends FinancialBody, R>(path: FinancialPath) {
    const { user } = useAuth();
    const [pending, setPending] = useState<PendingOperation<B> | null>(null);
    const [storageError, setStorageError] = useState('');
    const [checking, setChecking] = useState(true);
    const [busy, setBusy] = useState(false);
    const active = useRef(false);
    const reads = useRef(0);

    const reload = useCallback(async () => {
        const version = ++reads.current;
        try {
            const saved = await getPendingFinancialRequest<B>(path);
            if (version !== reads.current) return;
            setPending(saved);
            setStorageError('');
        } catch (error) {
            if (version !== reads.current) return;
            setStorageError(error instanceof Error ? error.message : 'Could not read saved transaction.');
        } finally { if (version === reads.current) setChecking(false); }
    }, [path]);

    useEffect(() => {
        setPending(null);
        setChecking(true);
        void reload();
        const onStorage = () => void reload();
        window.addEventListener('storage', onStorage);
        window.addEventListener('focus', onStorage);
        return () => {
            reads.current++;
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('focus', onStorage);
        };
    }, [user?.id, reload]);

    const execute = async (body: B): Promise<R> => {
        if (active.current) throw new Error('This transaction is already being confirmed.');
        active.current = true;
        setBusy(true);
        try { return await financialRequest<R>(path, body); }
        finally {
            active.current = false;
            setBusy(false);
            await reload();
        }
    };

    const retry = async (): Promise<R> => {
        const saved = await getPendingFinancialRequest<B>(path);
        if (!saved) throw new Error('There is no saved transaction to retry. Refresh your balances before starting another.');
        return execute(saved.body);
    };

    return { pending, checking, busy, storageError, execute, retry, reload };
}
