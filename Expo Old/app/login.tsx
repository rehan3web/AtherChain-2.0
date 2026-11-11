import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  runOnJS,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Passkey } from "react-native-passkey";

import { useColors } from "@/hooks/useColors";
import { AppInput } from "@/components/auth/AppInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { ProgressBar } from "@/components/auth/ProgressBar";
import { OtpInput } from "@/components/auth/OtpInput";

import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/services/api";
import { useToast } from "@/contexts/ToastContext";

const { width } = Dimensions.get("window");

function ForgotScreen({ colors, onBack }: { colors: any; onBack: () => void }) {
  const { forgotPassword, verifyResetOTP, resetPassword, pendingEmail } = useAuth();
  const { toast } = useToast();
  const [screen, setScreen] = useState<"email" | "code" | "reset">("email");
  const [email, setEmail] = useState(pendingEmail || "");
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [pw, setPw] = useState("");
  const [cpw, setCpw] = useState("");
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSendCode = async () => {
    if (!email.trim()) { toast("Please enter your email", "warning"); return; }
    setLoading(true);
    const res = await forgotPassword(email.trim());
    setLoading(false);
    if (res.success) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setScreen("code");
    } else {
      toast(res.error || "Failed to send reset code", "error");
    }
  };

  const handleVerifyCode = async () => {
    const joinedCode = code.join("");
    if (joinedCode.length < 6) { toast("Enter the 6-digit code", "warning"); return; }
    setLoading(true);
    const res = await verifyResetOTP(email, joinedCode);
    setLoading(false);
    if (res.success) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setScreen("reset");
    } else {
      toast(res.error || "Invalid verification code", "error");
    }
  };

  const handleReset = async () => {
    if (!pw || pw !== cpw) { toast("Passwords do not match", "error"); return; }
    setLoading(true);
    const res = await resetPassword(email, code.join(""), pw);
    setLoading(false);
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast("Password reset successful", "success");
      onBack();
    } else {
      toast(res.error || "Failed to reset password", "error");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={screen === "email" ? onBack : () => setScreen(screen === "reset" ? "code" : "email")} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        <View style={[styles.iconCircleBig, { backgroundColor: colors.primaryPale, marginTop: 24, alignSelf: "center", marginBottom: 32 }]}>
          <Feather name={screen === "code" ? "mail" : screen === "reset" ? "lock" : "key"} size={32} color={colors.primary} />
        </View>

        {screen === "email" && (
          <View>
            <Text style={[styles.title, { color: colors.text, textAlign: "center" }]}>Forgot Password?</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: "center" }]}>Enter your email and we'll send you a verification code.</Text>
            <AppInput placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <PrimaryButton title="Send Reset Code" onPress={handleSendCode} loading={loading} />
          </View>
        )}

        {screen === "code" && (
          <View>
            <Text style={[styles.title, { color: colors.text, textAlign: "center" }]}>Verify Code</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: "center" }]}>We sent a 6-digit code to {email}.</Text>
            <View style={{ marginBottom: 24 }}>
              <OtpInput length={6} value={code} onChange={setCode} autoFocus />
            </View>
            <PrimaryButton title="Verify Code" onPress={handleVerifyCode} loading={loading} />
          </View>
        )}

        {screen === "reset" && (
          <View>
            <Text style={[styles.title, { color: colors.text, textAlign: "center" }]}>New Password</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: "center" }]}>Create a strong new password.</Text>
            <AppInput placeholder="New Password" value={pw} onChangeText={setPw} secureTextEntry />
            <AppInput placeholder="Confirm Password" value={cpw} onChangeText={setCpw} secureTextEntry />
            <PrimaryButton title="Reset Password" onPress={handleReset} loading={loading} />
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { signIn, signInWithToken, verifyEmail, resendOtp, verify2FA, start2FARecovery, verify2FARecovery, pendingEmail, pendingUserId, setIsBlocked } = useAuth();

  const [step, setStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(2);
  const [authFlowStep, setAuthFlowStep] = useState<"2fa_otp" | "2fa_recovery" | "verify_email" | "none">("none");
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // Modals state
  const [twoFaCode, setTwoFaCode] = useState<string[]>(Array(6).fill(""));
  const [otpCode, setOtpCode] = useState<string[]>(Array(6).fill(""));
  const [otpError, setOtpError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionLimitSessions, setSessionLimitSessions] = useState<any[]>([]);
  const [sessionMgmtToken, setSessionMgmtToken] = useState("");
  const [removingSessionId, setRemovingSessionId] = useState<string | null>(null);

  const [recoveryOtp, setRecoveryOtp] = useState<string[]>(Array(6).fill(""));

  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const animateToStep = (newStep: number, direction: "forward" | "backward") => {
    const outX = direction === "forward" ? -(width * 0.35) : width * 0.35;
    const inX = direction === "forward" ? width * 0.35 : -(width * 0.35);

    translateX.value = withTiming(outX, { duration: 210 });
    opacity.value = withTiming(0, { duration: 175 }, () => {
      runOnJS(setStep)(newStep);
      translateX.value = inX;
      translateX.value = withTiming(0, { duration: 210 });
      opacity.value = withTiming(1, { duration: 210 });
    });
  };

  const handleNext = () => {
    if (step === 1) {
      if (!form.identifier.trim()) {
        setErrors({ identifier: "Email or username is required" });
        return;
      }
      setErrors({});
      animateToStep(2, "forward");
    } else if (step === 2) {
      if (!form.password) {
        setErrors({ password: "Password is required" });
        return;
      }
      setErrors({});
      pressLogin();
    } else if (step === 3) {
      if (authFlowStep === "2fa_otp") handle2FA();
      else if (authFlowStep === "2fa_recovery") handleVerifyRecovery();
      else if (authFlowStep === "verify_email") handleVerifyOtp();
    }
  };

  const handleBack = () => {
    if (step === 1) {
      router.back();
    } else if (step === 2) {
      setErrors({});
      animateToStep(1, "backward");
    } else if (step === 3) {
      if (authFlowStep === "2fa_recovery") {
        setAuthFlowStep("2fa_otp"); // Soft back inside step 3
      } else {
        setTotalSteps(2);
        animateToStep(2, "backward");
      }
    }
  };

  const pressLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    const res = await signIn(form.identifier.trim(), form.password);
    setLoading(false);
    if (res.success) {
      router.replace("/(tabs)" as any);
    } else if (res.require2FA) {
      setTwoFaCode(Array(6).fill(""));
      setAuthFlowStep("2fa_otp");
      setTotalSteps(3);
      animateToStep(3, "forward");
    } else if (res.requireVerify) {
      setOtpCode(Array(6).fill(""));
      setOtpError("");
      setAuthFlowStep("verify_email");
      setTotalSteps(3);
      animateToStep(3, "forward");
    } else if (res.sessionLimitExceeded) {
      setSessionLimitSessions(res.sessions ?? []);
      setSessionMgmtToken(res.sessionManagementToken ?? "");
      setShowSessionModal(true);
    } else if (res.blocked) {
      setIsBlocked(true);
    } else {
      setErrors({ password: res.error || "Invalid credentials" });
      toast(res.error || "Invalid credentials", "error");
    }
  };

  const pressPasskeyLogin = async () => {
    if (!form.identifier.trim()) {
      toast("Please enter your email or username first", "warning");
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      if (!Passkey.isSupported) {
        toast("Passkeys are not supported on this device.", "error");
        setLoading(false);
        return;
      }
      
      const identityPayload = form.identifier.includes("@") 
        ? { email: form.identifier.trim() } 
        : { username: form.identifier.trim() };

      const optionsRes = await authApi.passkeyLoginOptions(identityPayload);
      const result = await Passkey.get(optionsRes);
      
      const verifyRes = await authApi.passkeyLoginVerify(result, identityPayload);
      
      if (verifyRes.verified && verifyRes.token) {
        const res = await signInWithToken(verifyRes.token, verifyRes.user);
        if (res.success) {
          toast("Passkey login successful", "success");
          router.replace("/(tabs)" as any);
        } else if (res.blocked) {
          setIsBlocked(true);
        } else {
          toast(res.error || "Login setup failed", "error");
        }
      } else {
        toast("Passkey verification failed.", "error");
      }
    } catch (err: any) {
      toast(err?.response?.data?.message || err.message || "Passkey login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSessionLimit = async (sessionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRemovingSessionId(sessionId);
    try {
      await authApi.removeSessionManaged(sessionId, sessionMgmtToken);
      const remaining = sessionLimitSessions.filter((s) => (s.id ?? s._id) !== sessionId);
      setSessionLimitSessions(remaining);
      if (remaining.length < 2) {
        setShowSessionModal(false);
        setLoading(true);
        const res = await signIn(form.identifier.trim(), form.password);
        setLoading(false);
        if (res.success) {
          router.replace("/(tabs)" as any);
        } else if (res.require2FA) {
          setTwoFaCode(Array(6).fill(""));
          setAuthFlowStep("2fa_otp");
          setTotalSteps(3);
          animateToStep(3, "forward");
        } else if (res.requireVerify) {
          setOtpCode(Array(6).fill(""));
          setOtpError("");
          setAuthFlowStep("verify_email");
          setTotalSteps(3);
          animateToStep(3, "forward");
        } else if (res.blocked) {
          setIsBlocked(true);
        } else {
          toast(res.error || "Login failed", "error");
        }
      }
    } catch {
      toast("Failed to remove session. Try again.", "error");
      setShowSessionModal(false);
    } finally {
      setRemovingSessionId(null);
    }
  };

  const handle2FA = async () => {
    const joinedCode = twoFaCode.join("");
    if (joinedCode.length < 6) { toast("Enter the 6-digit 2FA code", "warning"); return; }
    setLoading(true);
    const res = await verify2FA(joinedCode);
    setLoading(false);
    if (res.success) {
      router.replace("/(tabs)" as any);
    } else {
      toast(res.error || "Invalid 2FA code", "error");
    }
  };

  const handleStartRecovery = async () => {
    if (!pendingUserId) return;
    setLoading(true);
    const res = await start2FARecovery(pendingUserId);
    setLoading(false);
    if (res.success) {
      setAuthFlowStep("2fa_recovery");
    } else {
      toast(res.error || "Failed to start recovery", "error");
    }
  };

  const handleVerifyRecovery = async () => {
    if (!pendingUserId) return;
    const joinedOtp = recoveryOtp.join("");
    if (joinedOtp.length < 6) { toast("Enter the 6-digit recovery code", "warning"); return; }
    setLoading(true);
    const res = await verify2FARecovery(pendingUserId, joinedOtp);
    setLoading(false);
    if (res.success) {
      router.replace("/(tabs)" as any);
    } else {
      toast(res.error || "Invalid recovery code", "error");
    }
  };

  const handleVerifyOtp = async () => {
    const email = pendingEmail || form.identifier;
    const joinedOtp = otpCode.join("");
    if (!email || joinedOtp.length < 6) { setOtpError("Enter the 6-digit verification code"); return; }
    setLoading(true);
    setOtpError("");
    const res = await verifyEmail(email, joinedOtp);
    setLoading(false);
    if (res.success) {
      router.replace("/(tabs)" as any);
    } else {
      setOtpError(res.error || "Invalid code. Try again.");
    }
  };

  const handleResendOtp = async () => {
    const email = pendingEmail || form.identifier;
    if (!email || resendLoading) return;
    setResendLoading(true);
    setResendSuccess(false);
    setOtpError("");
    try {
      await resendOtp(email);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch {
      setOtpError("Failed to resend. Try again.");
    } finally {
      setResendLoading(false);
    }
  };

  if (showForgot) {
    return <ForgotScreen colors={colors} onBack={() => setShowForgot(false)} />;
  }

  const getButtonTitle = () => {
    if (step === 3) {
      if (authFlowStep === "2fa_recovery") return "Verify & Reset";
      if (authFlowStep === "verify_email") return "Verify Email";
      return "Verify 2FA";
    }
    return step === 2 ? "Log In" : "Next";
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.progressWrapper}>
          <ProgressBar currentStep={step} totalSteps={totalSteps} />
        </View>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>
          {step}/{totalSteps}
        </Text>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Animated.View style={animatedStyle}>
          {step === 1 && (
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Enter your email or username to continue
              </Text>
              <AppInput
                placeholder="Email or Username"
                value={form.identifier}
                onChangeText={t => setForm(f => ({ ...f, identifier: t }))}
                error={errors.identifier}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={handleNext}
              />
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Enter password</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Welcome back,{" "}
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {form.identifier.split("@")[0]}
                </Text>
              </Text>
              <AppInput
                placeholder="Password"
                value={form.password}
                onChangeText={t => setForm(f => ({ ...f, password: t }))}
                error={errors.password}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleNext}
              />
              <TouchableOpacity
                onPress={() => setShowForgot(true)}
                style={styles.forgotBtn}
              >
                <Text style={[styles.linkText, { color: colors.primary }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && authFlowStep === "2fa_otp" && (
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Two-Factor Auth</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Enter the 6-digit code from your authenticator app.
              </Text>
              <View style={{ marginTop: 8, marginBottom: 24 }}>
                <OtpInput length={6} value={twoFaCode} onChange={setTwoFaCode} autoFocus />
              </View>
              <TouchableOpacity onPress={handleStartRecovery} disabled={loading} style={{ alignItems: "center" }}>
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Reset Auth via Email</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && authFlowStep === "2fa_recovery" && (
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Reset 2FA</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Enter the 6-digit code sent to your email to recover your account.
              </Text>
              <View style={{ marginTop: 8, marginBottom: 24 }}>
                <OtpInput length={6} value={recoveryOtp} onChange={setRecoveryOtp} autoFocus />
              </View>
            </View>
          )}

          {step === 3 && authFlowStep === "verify_email" && (
             <View>
              <Text style={[styles.title, { color: colors.text }]}>Verify Your Email</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                We sent a code to {pendingEmail || form.identifier}.
              </Text>
              <View style={{ marginTop: 8, marginBottom: 24 }}>
                <OtpInput length={6} value={otpCode} onChange={setOtpCode} autoFocus />
              </View>
              {otpError ? <Text style={[styles.otpErrorText, { color: colors.destructive, marginBottom: 16 }]}>{otpError}</Text> : null}
              {resendSuccess ? (
                <View style={[styles.resendRow, { marginTop: 0 }]}>
                  <Feather name="check-circle" size={14} color={colors.primary} />
                  <Text style={[styles.resendLink, { color: colors.primary }]}>Code sent! Check your inbox.</Text>
                </View>
              ) : (
                <View style={[styles.resendRow, { marginTop: 0 }]}>
                  <Text style={[styles.resendText, { color: colors.mutedForeground }]}>Didn't receive code?</Text>
                  <TouchableOpacity onPress={handleResendOtp} disabled={resendLoading} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {resendLoading
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Text style={[styles.resendLink, { color: colors.primary }]}>Resend</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
             </View>
          )}
        </Animated.View>
      </KeyboardAwareScrollView>

      {/* Sticky footer */}
      <View style={[styles.footer, { paddingBottom: bottomPad + 16 }]}>
        <PrimaryButton
          title={getButtonTitle()}
          onPress={handleNext}
          loading={loading}
        />
        {step === 1 && (
          <>
            <View style={styles.gap} />
            <TouchableOpacity
              style={[
                styles.passkeyBtn,
                {
                  backgroundColor: colors.secondary,
                  borderRadius: colors.radius,
                  borderColor: colors.border,
                },
              ]}
              onPress={pressPasskeyLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Feather name="shield" size={18} color={colors.primary} />
              <Text style={[styles.passkeyText, { color: colors.text }]}>
                Login via Passkey
              </Text>
            </TouchableOpacity>
          </>
        )}
        {step === 1 && (
          <TouchableOpacity
            style={styles.signupLink}
            onPress={() => router.replace("/register" as any)}
          >
            <Text style={[styles.signupText, { color: colors.mutedForeground }]}>
              Don't have an account?{" "}
              <Text style={{ color: colors.primary, fontWeight: "600" }}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Session Modal */}
      <Modal visible={showSessionModal} animationType="slide" transparent onRequestClose={() => setShowSessionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[styles.otpPanelHeader, { marginBottom: 4 }]}>
              <View style={[styles.otpIconCircle, { backgroundColor: "#fef2f2" }]}>
                <Feather name="monitor" size={22} color={colors.destructive} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.otpPanelTitle, { color: colors.text }]}>Session Limit Reached</Text>
                <Text style={[styles.otpPanelSub, { color: colors.mutedForeground }]}>Only 2 active sessions allowed. Remove one to continue.</Text>
              </View>
            </View>

            {sessionLimitSessions.length === 0 ? (
              <Text style={[styles.modalSub, { color: colors.mutedForeground, textAlign: "center", marginVertical: 16 }]}>No sessions found.</Text>
            ) : (
              sessionLimitSessions.map((session) => {
                const sid = session.id ?? session._id;
                const isRemoving = removingSessionId === sid;
                const deviceLabel = session.device
                  ? session.device.length > 40
                    ? session.device.slice(0, 40) + "…"
                    : session.device
                  : "Unknown Device";
                const loginDate = session.loginTime
                  ? new Date(session.loginTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                  : session.lastActive
                  ? new Date(session.lastActive).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "";
                return (
                  <View key={sid} style={[styles.sessionItem, { backgroundColor: colors.input, borderColor: colors.border }]}>
                    <View style={[styles.sessionIcon, { backgroundColor: colors.primaryPale }]}>
                      <Feather name={deviceLabel.toLowerCase().includes("mobile") || deviceLabel.toLowerCase().includes("android") || deviceLabel.toLowerCase().includes("iphone") ? "smartphone" : "monitor"} size={18} color={colors.primary} />
                    </View>
                    <View style={styles.sessionInfo}>
                      <Text style={[styles.sessionName, { color: colors.text }]} numberOfLines={1}>{deviceLabel}</Text>
                      {session.ip ? <Text style={[styles.sessionTime, { color: colors.mutedForeground }]}>{session.ip}{loginDate ? " · " + loginDate : ""}</Text> : loginDate ? <Text style={[styles.sessionTime, { color: colors.mutedForeground }]}>{loginDate}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveSessionLimit(sid)} disabled={!!removingSessionId} style={styles.removeBtn}>
                      {isRemoving ? <ActivityIndicator size="small" color={colors.destructive} /> : <Feather name="trash-2" size={20} color={colors.destructive} />}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            <View style={{ marginTop: 8 }}>
              <PrimaryButton variant="secondary" title="Cancel" onPress={() => setShowSessionModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  backBtn: { width: 32, alignItems: "center" },
  progressWrapper: { flex: 1 },
  stepLabel: { fontSize: 12, fontWeight: "500", width: 28, textAlign: "right" },
  scroll: { paddingHorizontal: 24, paddingTop: 4, flexGrow: 1 },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginBottom: 8,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 28,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  divider: { height: 1, marginVertical: 20 },
  passkeyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    gap: 8,
    borderWidth: 1.5,
  },
  passkeyText: { fontSize: 15, fontWeight: "500", fontFamily: "Inter_500Medium" },
  forgotBtn: { alignItems: "flex-end", marginTop: -4, marginBottom: 4 },
  linkText: { fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium" },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  gap: { height: 12 },
  signupLink: { marginTop: 16, alignItems: "center" },
  signupText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  iconCircleBig: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 12, borderWidth: 1, borderBottomWidth: 0 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  otpPanelHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 28, marginTop: 8 },
  otpIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  otpPanelTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  otpPanelSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  otpErrorText: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 10 },
  resendRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 18 },
  resendText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resendLink: { fontSize: 13, fontFamily: "Inter_700Bold" },

  modalSub: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 24 },
  sessionItem: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  sessionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: 12 },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  sessionTime: { fontSize: 13, fontFamily: "Inter_400Regular" },
  removeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(239, 68, 68, 0.1)" },
});
