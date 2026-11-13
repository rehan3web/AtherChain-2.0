import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { financialRequest, clearEligibleMiningRequest } from './financialRequests';
import { refreshBackendData } from './refresh';
import { getApiBaseUrl } from '../constants/apiConfig';
import { cachedRead, invalidateCache, mutationScope, requestPolicy } from './cache';

export { getApiBaseUrl } from '../constants/apiConfig';

const TOKEN_KEY = 'ather_token';
const DEVICE_KEY = 'ather_device_id';
const listeners = new Set<(reason: 'expired' | 'blocked') => void>();
let authGeneration = 0;

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
  }
}

export const getToken = () => Platform.OS === 'web'
  ? AsyncStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY);
export async function setToken(token: string) {
  if (!token) throw new Error('The server did not return an authentication token.');
  authGeneration++;
  invalidateCache();
  try {
    if (Platform.OS === 'web') await AsyncStorage.setItem(TOKEN_KEY, token);
    else await SecureStore.setItemAsync(TOKEN_KEY, token);
  } finally { authGeneration++; invalidateCache(); }
}
export async function clearToken(reason: 'expired' | 'blocked' = 'expired') {
  authGeneration++;
  invalidateCache();
  try {
    if (Platform.OS === 'web') await AsyncStorage.removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } finally { authGeneration++; invalidateCache(); listeners.forEach(listener => listener(reason)); }
}
export function onSessionExpired(listener: (reason: 'expired' | 'blocked') => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export async function getDeviceId() {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

type RequestOptions = {
  method?: string; body?: unknown; public?: boolean; headers?: Record<string, string>; force?: boolean; maxAge?: number;
};
async function fetchRequest<T>(path: string, options: RequestOptions, token: string | null): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const multipart = options.body instanceof FormData;
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(!multipart && options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data: any;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { throw new ApiError('The backend returned an invalid response.', response.status, {}); }
    if (!response.ok) {
      if (!options.public && (response.status === 401 || data.code === 'USER_BLOCKED'))
        await clearToken(data.code === 'USER_BLOCKED' ? 'blocked' : 'expired');
      throw new ApiError(data.message || data.error || `Request failed (${response.status}).`, response.status, data);
    }
    return data as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The backend did not respond in time. Check transaction history before retrying a payment.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const generation = authGeneration;
  const token = options.public ? null : await getToken();
  if (!options.public && generation !== authGeneration)
    throw new ApiError('Your session changed. Please retry.', 401, {});
  if (!options.public && !token) throw new ApiError('Please sign in to continue.', 401, {});
  if ((options.method ?? 'GET') === 'GET') {
    const policy = requestPolicy(path);
    return cachedRead(`${options.public ? 'public' : 'private'}:api:${getApiBaseUrl()}${path}`,
      () => fetchRequest<T>(path, options, token), {
        ...policy, ttl: options.maxAge === undefined ? policy.ttl : Math.min(policy.ttl, Math.max(0, options.maxAge)), force: options.force,
      });
  }
  const result = await fetchRequest<T>(path, options, token);
  const scope = mutationScope(path);
  if (scope === 'all' || scope.length) refreshBackendData(scope);
  return result;
}

const post = (path: string, body?: unknown, isPublic = false) =>
  request(path, { method: 'POST', body, public: isPublic });

async function financialPost(path: string, body: unknown = {}) {
  const generation = authGeneration;
  const token = await getToken();
  if (generation !== authGeneration) throw new ApiError('Your session changed. Please retry.', 401, {});
  if (!token) throw new ApiError('Please sign in to continue.', 401, {});
  return financialRequest(token, path, body, async key => {
    if (generation !== authGeneration) throw new ApiError('Your session changed. Please retry.', 401, {});
    const result = await request(path, { method: 'POST', body, headers: { 'Idempotency-Key': key } });
    const valid = path === '/wallet/send' ? typeof result.hash === 'string' && !!result.hash
      : path === '/swap/execute' ? result.success === true && result.status === 'completed'
        && typeof result.hash === 'string' && !!result.hash && typeof result.txId === 'string' && !!result.txId
        && Number.isFinite(result.receipt?.fromAmount) && result.receipt.fromAmount > 0
        && Number.isFinite(result.receipt?.rate) && result.receipt.rate > 0
        && Number.isFinite(result.receipt?.toAmount) && result.receipt.toAmount > 0
        && Number.isFinite(Date.parse(result.receipt?.createdAt))
        : path === '/mining/start' ? Number.isFinite(result.reward) && Number.isFinite(result.newBalance)
          : Number.isInteger(result.currentCycleBoosts);
    if (!valid) throw new ApiError('The receipt could not be verified. Retry the same details to recover it.', 200, result);
    if (result.historyPending) {
      for (const delay of [2000, 6000, 15000]) {
        const timer: any = setTimeout(() => refreshBackendData(['transactions', 'stats']), delay);
        timer?.unref?.();
      }
    }
    return result;
  });
}

export const authApi = {
  login: (emailOrUsername: string, password: string) => post('/auth/login', { emailOrUsername, password }, true),
  register: async (payload: Record<string, unknown>) =>
    post('/auth/register', { ...payload, deviceId: await getDeviceId() }, true),
  verifyEmail: (email: string, otp: string) => post('/auth/verify-email', { email, otp }, true),
  resendOtp: (email: string) => post('/auth/resend-otp', { email }, true),
  verify2FA: (userId: string, token: string) => post('/auth/verify-2fa-login', { userId, token }, true),
  verifySuspiciousLogin: (userId: string, otp: string) => post('/auth/verify-suspicious-login', { userId, otp }, true),
  forgotPassword: (email: string) => post('/auth/forgot-password', { email }, true),
  verifyResetOTP: (email: string, token: string) => post('/auth/verify-reset-otp', { email, token }, true),
  resetPassword: (email: string, token: string, newPassword: string) =>
    post('/auth/reset-password', { email, token, newPassword }, true),
  getSessions: () => request('/auth/sessions'),
  removeSession: (id: string) => request(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  removeSessionManaged: (id: string, managementToken: string) =>
    request(`/auth/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE', public: true, headers: { Authorization: `Bearer ${managementToken}` },
    }),
  removeAllSessions: () => request('/auth/sessions', { method: 'DELETE' }),
  approveQRLogin: (qrToken: string) => post('/auth/qr/approve', { qrToken }),
  passkeyLoginOptions: (payload: { email?: string; username?: string }) => post('/auth/passkey/login-options', payload, true),
  passkeyLoginVerify: (payload: unknown) => post('/auth/passkey/login-verify', payload, true),
};

export const userApi = {
  me: (options?: { force?: boolean; maxAge?: number }) => request('/user/me', options),
  dashboardStats: () => request('/user/dashboard/stats'),
  statistics: () => request('/user/statistics'),
  updateProfile: (payload: Record<string, unknown>) => request('/user/profile', { method: 'PUT', body: payload }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request('/user/password', { method: 'PUT', body: { currentPassword, newPassword } }),
  uploadProfileImage: (body: FormData) => post('/user/profile/image', body),
  removeProfileImage: () => request('/user/profile/image', { method: 'DELETE' }),
  passkeyRegisterOptions: () => post('/user/passkey/register-options'),
  passkeyRegisterVerify: (payload: unknown) => post('/user/passkey/register-verify', payload),
  passkeyRemove: (credentialID: string) => post('/user/passkey/remove', { credentialID }),
  generate2FA: () => post('/user/2fa/generate'),
  enable2FA: (token: string) => post('/user/2fa/verify', { token }),
  disable2FA: (token: string) => post('/user/2fa/disable', { token }),
  registerPushToken: (expo_push_token: string) => post('/user/push-token', { expo_push_token }),
};
export const miningApi = {
  status: () => request('/mining/status'),
  start: () => financialPost('/mining/start'),
  validate: async () => {
    const result = await post('/mining/validate');
    const token = await getToken();
    if (token) await clearEligibleMiningRequest(token);
    return result;
  },
  claimBoost: () => financialPost('/mining/claim-boost'),
};
export const walletApi = {
  stats: () => request('/wallet/stats'),
  send: (recipient: string, amount: number) => financialPost('/wallet/send', { recipient, amount }),
  lookup: (identifier: string) => post('/wallet/lookup', { identifier }),
};
export const swapApi = {
  rate: (options?: { force?: boolean }) => request('/swap/rate', options),
  status: () => request('/swap/status'),
  execute: (amountAT: number) => financialPost('/swap/execute', { amountAT, fromToken: 'AT', toToken: 'ATH' }),
};
export const transactionApi = {
  list: (page = 1, limit = 20, search = '') =>
    request(`/transactions?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),
};
export const referralApi = { stats: () => request('/referral/stats') };
export const notificationApi = {
  list: () => request('/notifications'),
  markAsRead: (id: string) => post(`/notifications/${encodeURIComponent(id)}/read`),
  preferences: () => request('/push-notifications/preferences'),
  toggleReminders: (enabled: boolean) => post('/push-notifications/toggle-reminders', { enabled }),
};
export const newsApi = { list: (pageState?: string) => request(`/news${pageState ? `?pageState=${encodeURIComponent(pageState)}` : ''}`, { public: true }) };
export function getMediaUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith('/')) throw new Error('The backend returned an invalid media URL.');
  return `${getApiBaseUrl()}${path}`;
}
export const kycApi = {
  status: () => request('/user/kyc/status'),
  config: () => request('/user/kyc/config'),
  submit: (body: FormData) => post('/user/kyc/submit', body),
  verifyTwitter: (twitter_username: string) => post('/user/kyc/verify-twitter', { twitter_username }),
};
export const supportApi = {
  list: (page = 1) => request(`/support?page=${page}`),
  getDetails: (id: string) => request(`/support/${encodeURIComponent(id)}`),
  create: (body: FormData) => post('/support', body),
  reply: (id: string, body: FormData) => post(`/support/${encodeURIComponent(id)}/reply`, body),
};
