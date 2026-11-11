import { useMemo } from 'react';

export const MAX_INT_DIGITS = 8;
export const MAX_VISIBLE_CONTACTS = 5;
export const BACKSPACE = 'del';

export type Money = {
  symbol: string;
  decimal: string;
  num: (v: number) => string;
  int: (n: number) => string;
  full: (v: number) => string;
};

/** Transaction amounts use a trailing ATH; the wallet balance keeps its prefix. */
export function formatReceiptAmount(money: Money, value: number): string {
  return money.symbol === 'ATH' ? `${money.num(value)} ATH` : money.full(value);
}

export function makeMoney(locale: string, currency: string): Money {
  const ath = currency === 'ATH';
  const numberOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: !ath };
  const integerOptions = { maximumFractionDigits: 0, useGrouping: !ath };
  let nf: Intl.NumberFormat;
  let grouped: Intl.NumberFormat;
  try {
    nf = new Intl.NumberFormat(locale, numberOptions);
    grouped = new Intl.NumberFormat(locale, integerOptions);
  } catch {
    nf = new Intl.NumberFormat('en-US', numberOptions);
    grouped = new Intl.NumberFormat('en-US', integerOptions);
  }
  let symbol = currency;
  let decimal = '.';
  try {
    symbol =
      new Intl.NumberFormat(locale, { style: 'currency', currency })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? currency;
    decimal = nf.formatToParts(1.1).find((p) => p.type === 'decimal')?.value ?? '.';
  } catch {
    /* formatToParts unavailable — keep fallbacks */
  }
  return {
    symbol,
    decimal,
    num: (v) => nf.format(v),
    int: (n) => grouped.format(n),
    full: (v) => `${symbol}${ath ? ' ' : ''}${nf.format(v)}`,
  };
}

export function useMoney(locale: string, currency: string) {
  return useMemo(() => makeMoney(locale, currency), [locale, currency]);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDate(d: Date | string | number, locale: string) {
  const date = new Date(d);
  let day: string;
  try {
    day = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
  } catch {
    day = date.toDateString().slice(4, 10);
  }
  return `${day} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Keypad logic on a raw string like "12.5" — avoids float math entirely
export function press(raw: string, key: string): string {
  if (key === BACKSPACE) return raw.slice(0, -1);
  if (key === '.') return raw.includes('.') ? raw : raw === '' ? '0.' : `${raw}.`;
  if (raw.includes('.')) return raw.split('.')[1].length >= 2 ? raw : raw + key;
  if (raw.length >= MAX_INT_DIGITS) return raw;
  if (raw === '0') return key === '0' ? raw : key;
  return raw + key;
}

export function showRaw(raw: string, m: Money) {
  const [i = '', d = ''] = raw.split('.');
  const int = m.int(Number(i || '0'));
  return raw.includes('.') ? `${int}${m.decimal}${d}` : int;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
