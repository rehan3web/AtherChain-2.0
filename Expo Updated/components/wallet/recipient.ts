import type { RecipientMethod, TransferRecipient } from './types';

/** Only normalize formatting; never alter a wallet address's case. */
export function normalizeRecipient(method: RecipientMethod, value: string): TransferRecipient {
  const trimmed = value.trim();
  return {
    method,
    value: method === 'username' && trimmed
      ? `@${trimmed.replace(/^@/, '')}`
      : trimmed,
  };
}

/** Local format checks only, not account existence or on-chain verification. */
export function recipientError(method: RecipientMethod, value: string): string | null {
  const normalized = normalizeRecipient(method, value).value;
  if (!normalized) {
    return method === 'email' ? 'Enter an email address.'
      : method === 'username' ? 'Enter a username.'
        : 'Enter a wallet address.';
  }
  if (method === 'email') {
    return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)
      ? null
      : 'Enter a valid email address.';
  }
  if (method === 'username') {
    return /^@[a-zA-Z0-9_.]{3,32}$/.test(normalized)
      ? null
      : 'Use 3–32 letters, numbers, underscores or dots.';
  }
  const valid = /^0x/i.test(normalized)
    ? /^0x[0-9a-fA-F]{40}$/i.test(normalized)
    : /^[a-zA-Z0-9]{20,128}$/.test(normalized);
  return valid ? null : 'Enter a complete wallet address without spaces.';
}
