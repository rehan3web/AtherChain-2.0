'use client';

interface Props {
    description: string;
    busy: boolean;
    onRetry: () => void;
}

export function PendingTransaction({ description, busy, onRetry }: Props) {
    return (
        <div role="status" className="border border-amber-500/40 bg-amber-500/10 p-4 space-y-3 mb-6">
            <p className="text-sm font-semibold">Transaction result unconfirmed</p>
            <p className="text-sm break-all">{description}</p>
            <p className="text-xs text-muted-foreground">
                Retry the saved request with its original key. This confirms the result without submitting a second transaction.
                Do not clear browser data while this request is unresolved.
            </p>
            <button onClick={onRetry} disabled={busy} className="border border-border px-4 py-2 text-sm disabled:opacity-50">
                {busy ? 'Confirming…' : 'Retry saved transaction'}
            </button>
        </div>
    );
}
