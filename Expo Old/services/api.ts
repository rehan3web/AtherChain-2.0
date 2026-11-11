import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "ather_token";
const DEVICE_ID_KEY = "ather_device_id";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const getDeviceId = async (): Promise<string> => {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

export const getToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(TOKEN_KEY);
};

export const setToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = async (): Promise<void> => {
  await AsyncStorage.removeItem(TOKEN_KEY);
};

function getApiBaseUrl(): string {
  // Explicit override — set EXPO_PUBLIC_API_URL in .env.local for local dev
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    const host = window.location?.hostname ?? "";
    // Replit hosted — use reverse-proxy path
    if (host.includes("replit") || host.includes("repl.co") || host.includes("repl.dev")) {
      return "/api";
    }
    // Local web dev (localhost / LAN IP) — hit backend directly
    return "https://api.atherchain.com";
  }
  // Native (Expo Go) — use laptop IP
  return "https://api.atherchain.com";
}

let _onUnauthorized: (() => void) | null = null;
let _onBlocked: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  _onUnauthorized = handler;
}

export function setBlockedHandler(handler: () => void) {
  _onBlocked = handler;
}

const api: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await clearToken();
      _onUnauthorized?.();
    } else if (error.response?.status === 403 && error.response?.data?.code === 'USER_BLOCKED') {
      await clearToken();
      _onBlocked?.();
    }
    return Promise.reject(error);
  }
);

function extractError(err: any): string {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    "Something went wrong"
  );
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (emailOrUsername: string, password: string) => {
    const { data } = await api.post("/auth/login", { emailOrUsername, password });
    return data;
  },
  register: async (payload: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone: string;
    password: string;
    referralCode?: string;
    country: string;
  }) => {
    const deviceId = await getDeviceId();
    const { data } = await api.post("/auth/register", { ...payload, deviceId });
    return data;
  },
  verifyEmail: async (email: string, otp: string) => {
    const { data } = await api.post("/auth/verify-email", { email, otp });
    return data;
  },
  resendOtp: async (email: string) => {
    const { data } = await api.post("/auth/resend-otp", { email });
    return data;
  },
  forgotPassword: async (email: string) => {
    const { data } = await api.post("/auth/forgot-password", { email });
    return data;
  },
  verifyResetOTP: async (email: string, token: string) => {
    const { data } = await api.post("/auth/verify-reset-otp", { email, token });
    return data;
  },
  resetPassword: async (email: string, token: string, newPassword: string) => {
    const { data } = await api.post("/auth/reset-password", { email, token, newPassword });
    return data;
  },
  verify2FA: async (userId: string, token: string) => {
    const { data } = await api.post("/auth/verify-2fa-login", { userId, token });
    return data;
  },
  start2FARecovery: async (userId: string) => {
    const { data } = await api.post("/auth/start-2fa-recovery", { userId });
    return data;
  },
  verify2FARecovery: async (userId: string, otp: string) => {
    const { data } = await api.post("/auth/verify-2fa-recovery", { userId, otp });
    return data;
  },
  getSessions: async () => {
    const { data } = await api.get("/auth/sessions");
    return data;
  },
  removeSession: async (sessionId: string) => {
    const { data } = await api.delete(`/auth/sessions/${sessionId}`);
    return data;
  },
  removeSessionManaged: async (sessionId: string, managementToken: string) => {
    const { data } = await axios.delete(`${getApiBaseUrl()}/auth/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${managementToken}`, "Content-Type": "application/json" },
      timeout: 15000,
    });
    return data;
  },
  removeAllSessions: async () => {
    const { data } = await api.delete("/auth/sessions");
    return data;
  },
  checkVersion: async (version: string) => {
    const { data } = await api.post("/auth/check-version", { version });
    return data;
  },
  approveQRLogin: async (qrToken: string) => {
    const { data } = await api.post("/auth/qr/approve", { qrToken });
    return data;
  },
  passkeyLoginOptions: async (payload: { email?: string; username?: string }) => {
    const { data } = await api.post("/auth/passkey/login-options", payload);
    return data;
  },
  passkeyLoginVerify: async (attestationResponse: any, payload: { email?: string; username?: string }) => {
    const { data } = await api.post("/auth/passkey/login-verify", { ...attestationResponse, ...payload });
    return data;
  },
};

// ─── User ───────────────────────────────────────────────────────────────────

export const userApi = {
  me: async () => {
    const { data } = await api.get("/user/me");
    return data;
  },
  dashboardStats: async () => {
    const { data } = await api.get("/user/dashboard/stats");
    return data;
  },
  statistics: async () => {
    const { data } = await api.get("/user/statistics");
    return data;
  },
  updateProfile: async (payload: { firstName?: string; lastName?: string; country?: string }) => {
    const { data } = await api.put("/user/profile", payload);
    return data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const { data } = await api.put("/user/password", { oldPassword: currentPassword, newPassword });
    return data;
  },
  uploadProfileImage: async (imageUri: string) => {
    const formData = new FormData();
    const filename = imageUri.split("/").pop() || "profile.jpg";

    // In React Native, the file object for FormData needs uri, name, and type
    formData.append("image", {
      uri: imageUri,
      name: filename,
      type: "image/jpeg"
    } as any);

    const { data } = await api.post("/user/profile/image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return data;
  },
  removeProfileImage: async () => {
    const { data } = await api.delete("/user/profile/image");
    return data;
  },
  generate2FA: async () => {
    const { data } = await api.post("/user/2fa/generate");
    return data;
  },
  verify2FA: async (token: string) => {
    const { data } = await api.post("/user/2fa/verify", { token });
    return data;
  },
  disable2FA: async (token: string) => {
    const { data } = await api.post("/user/2fa/disable", { token });
    return data;
  },
  kycStatus: async () => {
    const { data } = await api.get(`/user/kyc/status?t=${Date.now()}`);
    return data;
  },
  registerPushToken: async (token: string) => {
    const { data } = await api.post("/user/push-token", { expo_push_token: token });
    return data;
  },
  passkeyRegisterOptions: async () => {
    const { data } = await api.post("/user/passkey/register-options");
    return data;
  },
  passkeyRegisterVerify: async (attestationResponse: any) => {
    const { data } = await api.post("/user/passkey/register-verify", attestationResponse);
    return data;
  },
  passkeyRemove: async (credentialID: string) => {
    const { data } = await api.post("/user/passkey/remove", { credentialID });
    return data;
  },
};

// ─── KYC ────────────────────────────────────────────────────────────────────

export const kycApi = {
  status: async () => {
    const { data } = await api.get(`/user/kyc/status?t=${Date.now()}`);
    return data;
  },
  submit: async (formData: FormData) => {
    const { data } = await api.post("/user/kyc/submit", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  config: async () => {
    const { data } = await api.get("/user/kyc/config");
    return data;
  },
  verifyTwitter: async (twitter_username: string) => {
    const { data } = await api.post("/user/kyc/verify-twitter", { twitter_username });
    return data;
  },
};

// ─── Mining ─────────────────────────────────────────────────────────────────

export const miningApi = {
  status: async () => {
    const { data } = await api.get("/mining/status");
    return data;
  },
  start: async () => {
    const { data } = await api.post("/mining/start");
    return data;
  },
  claimBoost: async () => {
    const { data } = await api.post("/mining/claim-boost");
    return data;
  },
  validate: async () => {
    const { data } = await api.post("/mining/validate");
    return data;
  },
};

// ─── Wallet ─────────────────────────────────────────────────────────────────

export const walletApi = {
  stats: async () => {
    const { data } = await api.get("/wallet/stats");
    return data;
  },
  send: async (recipient: string, amount: number) => {
    const { data } = await api.post("/wallet/send", { recipient, amount });
    return data;
  },
  lookup: async (identifier: string) => {
    const { data } = await api.post("/wallet/lookup", { identifier });
    return data;
  },
  claim: async () => {
    const { data } = await api.post("/wallet/claim");
    return data;
  },
  claimStatus: async () => {
    const { data } = await api.get("/wallet/claim-status");
    return data;
  },
};

// ─── Transactions ────────────────────────────────────────────────────────────

export const transactionApi = {
  list: async (page = 1, limit = 20, search = "") => {
    const { data } = await api.get("/transactions", { params: { page, limit, search } });
    return data;
  },
};

// ─── Swap ────────────────────────────────────────────────────────────────────

export const swapApi = {
  rate: async () => {
    const { data } = await api.get("/swap/rate");
    return data;
  },
  execute: async (amountAT: number) => {
    const { data } = await api.post("/swap/execute", {
      amountAT,
      fromToken: "AT",
      toToken: "ATH",
    });
    return data;
  },
  status: async () => {
    const { data } = await api.get("/swap/status");
    return data;
  },
};

// ─── Market ──────────────────────────────────────────────────────────────────

export const marketApi = {
  top: async () => {
    const { data } = await api.get("/market/top");
    return data;
  },
};

// ─── Referral ────────────────────────────────────────────────────────────────

export const referralApi = {
  stats: async () => {
    const { data } = await api.get("/referral/stats");
    return data;
  },
};

// ─── News ─────────────────────────────────────────────────────────────────────

export const newsApi = {
  list: async (pageState?: string) => {
    const { data } = await api.get("/news", { params: pageState ? { pageState } : {} });
    return data as { posts: { id: string; title: string; description: string; image_url?: string; created_at: string }[]; pageState: string | null };
  },
};

// ─── Support ──────────────────────────────────────────────────────────────────

export const supportApi = {
  list: async () => {
    const { data } = await api.get("/support/");
    return data as { tickets: any[]; pagination: any };
  },
  create: async (title: string, message: string, imageUri?: string) => {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("message", message);
    if (imageUri) {
      const filename = imageUri.split("/").pop() || "support.jpg";
      formData.append("image", { uri: imageUri, name: filename, type: "image/jpeg" } as any);
    }
    const { data } = await api.post("/support/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  getDetails: async (id: string) => {
    const { data } = await api.get(`/support/${id}`);
    return data as { ticket: any; messages: any[] };
  },
  reply: async (id: string, message: string, imageUri?: string) => {
    const formData = new FormData();
    formData.append("message", message);
    if (imageUri) {
      const filename = imageUri.split("/").pop() || "reply.jpg";
      formData.append("image", { uri: imageUri, name: filename, type: "image/jpeg" } as any);
    }
    const { data } = await api.post(`/support/${id}/reply`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationApi = {
  list: async () => {
    const { data } = await api.get("/notifications");
    return data as { id: string; title: string; message: string; created_at: string; read: boolean }[];
  },
  markAsRead: async (id: string) => {
    const { data } = await api.post(`/notifications/${id}/read`);
    return data;
  },
  subscribe: async (token: string) => {
    const res = await api.post('/push-notifications/subscribe', {
      subscription: token,
    });
    return res.data;
  }
};

// ─── Media URL ────────────────────────────────────────────────────────────────

export function getMediaUrl(relativePath: string): string {
  const base = getApiBaseUrl();
  return `${base}/${relativePath}`.replace(/([^:])\/\//g, "$1/");
}

export { extractError };
export default api;
