import { LedgerError } from './ledgerOperations';

const SCALE = 100000000n;
const MAX = 99999999999999999999n;

export function money(value: unknown, allowZero = false): bigint {
    let text: string;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new LedgerError(400, 'Invalid amount');
        text = value.toFixed(8);
        if (Number(text) !== value) throw new LedgerError(400, 'Amounts support at most eight decimal places');
    } else if (typeof value === 'string') text = value.trim();
    else throw new LedgerError(400, 'Invalid amount');
    if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(text)) throw new LedgerError(400, 'Invalid amount');
    const [whole, fraction = ''] = text.split('.');
    const units = BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, '0'));
    if (units > MAX || units < (allowZero ? 0n : 1n)) throw new LedgerError(400, 'Invalid amount');
    return units;
}

export function decimal(units: bigint): string {
    return `${units / SCALE}.${(units % SCALE).toString().padStart(8, '0')}`;
}

export function multiply(amount: bigint, rate: bigint): bigint {
    const result = (amount * rate + SCALE / 2n) / SCALE;
    if (result <= 0n || result > MAX) throw new LedgerError(400, 'Converted amount is outside the supported range');
    return result;
}
