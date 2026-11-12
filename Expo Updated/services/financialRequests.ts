import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const active = new Map<string, { signature: string; promise: Promise<any> }>();

async function slot(token: string, path: string) {
  let identity = '';
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    identity = String(claims.id ?? claims.userId ?? claims.sub ?? '');
  } catch { /* opaque sessions get a non-reversible scope below */ }
  const scope = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, identity || token);
  return `ather_pending_financial:${scope}:${path}`;
}

function signature(body: any) {
  const normalized = { ...body };
  for (const key of ['amount', 'amountAT']) {
    if (normalized[key] !== undefined) normalized[key] = String(normalized[key])
      .replace(/^0+(?=\d)/, '').replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  }
  return JSON.stringify(normalized);
}

/** Persist before sending. An uncertain response never silently creates a new key. */
export async function financialRequest<T>(
  token: string, path: string, body: unknown, send: (key: string) => Promise<T>
): Promise<T> {
  const storageKey = await slot(token, path);
  const details = signature(body ?? {});
  const inFlight = active.get(storageKey);
  if (inFlight) {
    if (inFlight.signature !== details) throw new Error('Resolve the pending payment before changing its details.');
    return inFlight.promise;
  }
  const promise = (async () => {
    const raw = await AsyncStorage.getItem(storageKey);
    const pending = raw ? JSON.parse(raw) : null;
    if (pending && pending.signature !== details)
      throw new Error('An earlier payment is unconfirmed. Retry its original details before starting a different payment.');
    const key = pending?.key ?? Crypto.randomUUID();
    await AsyncStorage.setItem(storageKey, JSON.stringify({ key, signature: details }));
    try {
      const result = await send(key);
      await AsyncStorage.removeItem(storageKey);
      return result;
    } catch (error: any) {
      // Only the ledger can attest that this request did not commit.
      // Auth/proxy/maintenance errors do not resolve an earlier uncertain attempt.
      if (error?.data?.code === 'NOT_COMMITTED') await AsyncStorage.removeItem(storageKey);
      throw error;
    }
  })();
  active.set(storageKey, { signature: details, promise });
  try { return await promise; } finally { active.delete(storageKey); }
}

export async function clearEligibleMiningRequest(token: string) {
  // Called only after the server validates a new mining entitlement.
  // SQL's locked last_mined_at guard still protects against in-flight races.
  await AsyncStorage.removeItem(await slot(token, '/mining/start'));
}
