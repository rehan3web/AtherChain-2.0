import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { authApi, clearToken, getToken, setToken, setUnauthorizedHandler, userApi } from "@/services/api";
import { getCachedProfilePic, setCachedProfilePic, removeCachedProfilePic } from "@/utils/profileCache";

export type User = {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  profileImage?: string;
  kycStatus?: string;
  twoFactorEnabled?: boolean;
  referralCode?: string;
  balance_ath?: string;
  balance_wath?: string;
  walletAddress?: string;
};

type AuthContextType = {
  isLoggedIn: boolean;
  isLoading: boolean;
  user: User | null;
  pendingEmail: string | null;
  pendingUserId: string | null;
  signIn: (emailOrUsername: string, password: string) => Promise<{ success: boolean; require2FA?: boolean; requireVerify?: boolean; error?: string; sessionLimitExceeded?: boolean; sessions?: any[]; sessionManagementToken?: string; blocked?: boolean }>;
  signInWithToken: (token: string, userData: User) => Promise<{ success: boolean; error?: string; blocked?: boolean }>;
  signUp: (payload: { firstName: string; lastName: string; username: string; email: string; phone: string; password: string; referralCode?: string; country: string }) => Promise<{ success: boolean; error?: string }>;
  verifyEmail: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  resendOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyResetOTP: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string, token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  verify2FA: (token: string) => Promise<{ success: boolean; error?: string }>;
  start2FARecovery: (userId: string) => Promise<{ success: boolean; error?: string }>;
  verify2FARecovery: (userId: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  profilePic: string | null;
  updateProfilePicState: (pic: string | null) => Promise<void>;
  isBlocked: boolean;
  setIsBlocked: (val: boolean) => void;
};

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isLoading: true,
  user: null,
  pendingEmail: null,
  pendingUserId: null,
  signIn: async () => ({ success: false }),
  signInWithToken: async () => ({ success: false }),
  signUp: async () => ({ success: false }),
  verifyEmail: async () => ({ success: false }),
  resendOtp: async () => ({ success: false }),
  forgotPassword: async () => ({ success: false }),
  verifyResetOTP: async () => ({ success: false }),
  resetPassword: async () => ({ success: false }),
  verify2FA: async () => ({ success: false }),
  start2FARecovery: async () => ({ success: false }),
  verify2FARecovery: async () => ({ success: false }),
  refreshUser: async () => {},
  signOut: async () => {},
  profilePic: null,
  updateProfilePicState: async () => {},
  isBlocked: false,
  setIsBlocked: () => {},
});

const USER_CACHE_KEY = "ather_user_cache";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);

  const signOutRef = useRef<(() => Promise<void>) | null>(null);

  const signOut = useCallback(async () => {
    if (user?.id) {
      await removeCachedProfilePic(user.id);
    }
    await clearToken();
    await AsyncStorage.removeItem(USER_CACHE_KEY);
    setUser(null);
    setIsLoggedIn(false);
    setPendingEmail(null);
    setPendingUserId(null);
    setProfilePic(null);
  }, [user?.id]);

  signOutRef.current = signOut;

  useEffect(() => {
    import("@/services/api").then(({ setBlockedHandler }) => {
      setBlockedHandler(() => {
        signOutRef.current?.();
        setIsBlocked(true);
      });
    });
    setUnauthorizedHandler(() => {
      signOutRef.current?.();
    });

    (async () => {
      const token = await getToken();
      if (token) {
        const cached = await AsyncStorage.getItem(USER_CACHE_KEY);
        if (cached) {
          try {
            setUser(JSON.parse(cached));
            setIsLoggedIn(true);
          } catch {}
        }
        try {
          const data = await userApi.me();
          const u: User = data.user ?? data;
          setUser(u);
          setIsLoggedIn(true);
          await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
        } catch (err: any) {
          // Forcefully logout if the session API fails for ANY reason
          await clearToken();
          await AsyncStorage.removeItem(USER_CACHE_KEY);
          setIsLoggedIn(false);
          setUser(null);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await userApi.me();
      const u: User = data.user ?? data;
      setUser(u);
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
    } catch {}
  }, []);

  const signIn = useCallback(async (emailOrUsername: string, password: string) => {
    try {
      const data = await authApi.login(emailOrUsername, password);
      if (data.require2FA) {
        setPendingUserId(data.userId ?? null);
        setPendingEmail(emailOrUsername);
        return { success: false, require2FA: true };
      }
      if (data.requireVerify || data.requireEmailVerification) {
        setPendingEmail(data.email ?? emailOrUsername);
        return { success: false, requireVerify: true };
      }
      const token = data.token ?? data.accessToken;
      if (!token) return { success: false, error: "No token received" };
      await setToken(token);
      const u: User = data.user ?? {};
      setUser(u);
      setIsLoggedIn(true);
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
      try {
        const me = await userApi.me();
        const full: User = me.user ?? me;
        setUser(full);
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(full));
      } catch {}
      return { success: true };
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const responseEmail = err?.response?.data?.email;
      if (code === "USER_BLOCKED") {
        return { success: false, blocked: true, error: err?.response?.data?.message || "Account is blocked" };
      }
      if (code === "EMAIL_NOT_VERIFIED") {
        const email = responseEmail ?? emailOrUsername;
        setPendingEmail(email);
        try { await authApi.resendOtp(email); } catch {}
        return { success: false, requireVerify: true };
      }
      if (code === "SESSION_LIMIT_EXCEEDED") {
        return {
          success: false,
          sessionLimitExceeded: true,
          sessions: err?.response?.data?.sessions ?? [],
          sessionManagementToken: err?.response?.data?.sessionManagementToken ?? "",
        };
      }
      const msg = err?.response?.data?.message || err?.message || "Login failed";
      return { success: false, error: msg };
    }
  }, []);

  const signInWithToken = useCallback(async (token: string, userData: User) => {
    try {
      await setToken(token);
      setUser(userData);
      setIsLoggedIn(true);
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
      try {
        const me = await userApi.me();
        const full: User = me.user ?? me;
        setUser(full);
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(full));
      } catch {}
      return { success: true };
    } catch (err: any) {
      if (err?.response?.data?.code === "USER_BLOCKED") {
        return { success: false, blocked: true, error: err?.response?.data?.message };
      }
      return { success: false, error: err.message };
    }
  }, []);

  const signUp = useCallback(async (payload: Parameters<AuthContextType["signUp"]>[0]) => {
    try {
      const data = await authApi.register(payload);
      setPendingEmail(payload.email);
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Registration failed";
      return { success: false, error: msg };
    }
  }, []);

  const verifyEmail = useCallback(async (email: string, otp: string) => {
    try {
      const data = await authApi.verifyEmail(email, otp);
      const token = data.token ?? data.accessToken;
      if (token) {
        await setToken(token);
        const u: User = data.user ?? {};
        setUser(u);
        setIsLoggedIn(true);
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
        try {
          const me = await userApi.me();
          const full: User = me.user ?? me;
          setUser(full);
          await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(full));
        } catch {}
      }
      setPendingEmail(null);
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Verification failed";
      return { success: false, error: msg };
    }
  }, []);

  const resendOtp = useCallback(async (email: string) => {
    try {
      await authApi.resendOtp(email);
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to resend OTP";
      return { success: false, error: msg };
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      await authApi.forgotPassword(email);
      setPendingEmail(email);
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed";
      return { success: false, error: msg };
    }
  }, []);

  const verifyResetOTP = useCallback(async (email: string, otp: string) => {
    try {
      await authApi.verifyResetOTP(email, otp);
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to verify code";
      return { success: false, error: msg };
    }
  }, []);

  const resetPassword = useCallback(async (email: string, token: string, newPassword: string) => {
    try {
      await authApi.resetPassword(email, token, newPassword);
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to reset password";
      return { success: false, error: msg };
    }
  }, []);

  const verify2FA = useCallback(async (token: string) => {
    try {
      if (!pendingUserId) return { success: false, error: "No pending login" };
      const data = await authApi.verify2FA(pendingUserId, token);
      const jwt = data.token ?? data.accessToken;
      if (!jwt) return { success: false, error: "No token received" };
      await setToken(jwt);
      const u: User = data.user ?? {};
      setUser(u);
      setIsLoggedIn(true);
      setPendingUserId(null);
      setPendingEmail(null);
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "2FA verification failed";
      return { success: false, error: msg };
    }
  }, [pendingUserId]);

  const start2FARecovery = useCallback(async (userId: string) => {
    try {
      await authApi.start2FARecovery(userId);
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to start 2FA recovery";
      return { success: false, error: msg };
    }
  }, []);

  const verify2FARecovery = useCallback(async (userId: string, otp: string) => {
    try {
      const data = await authApi.verify2FARecovery(userId, otp);
      const jwt = data.token ?? data.accessToken;
      if (!jwt) return { success: false, error: "No token received" };
      await setToken(jwt);
      const u: User = data.user ?? {};
      setUser(u);
      setIsLoggedIn(true);
      setPendingUserId(null);
      setPendingEmail(null);
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "2FA recovery failed";
      return { success: false, error: msg };
    }
  }, []);

  // Load cached profile photo when user changes
  useEffect(() => {
    if (user?.id) {
      const remote = user.profileImage || (user as any).profile_image;
      getCachedProfilePic(user.id, remote).then((pic) => {
        setProfilePic(pic);
      });
    } else {
      setProfilePic(null);
    }
  }, [user?.id, user?.profileImage, (user as any)?.profile_image]);

  const updateProfilePicState = useCallback(async (pic: string | null) => {
    setProfilePic(pic);
    if (user?.id) {
      if (pic) {
        await setCachedProfilePic(user.id, pic);
      } else {
        await removeCachedProfilePic(user.id);
      }
    }
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, user, pendingEmail, pendingUserId, signIn, signInWithToken, signUp, verifyEmail, resendOtp, forgotPassword, verifyResetOTP, resetPassword, verify2FA, start2FARecovery, verify2FARecovery, refreshUser, signOut, profilePic, updateProfilePicState, isBlocked, setIsBlocked }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
