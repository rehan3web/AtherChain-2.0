import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Pressable, StyleSheet, Text, View, ScrollView, ActivityIndicator, Modal, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

import { useColors } from "@/hooks/useColors";
import { useToast } from "@/contexts/ToastContext";
import { userApi, extractError } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { OtpInput } from "@/components/auth/OtpInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";

export default function TwoFAScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

  const [is2FA, setIs2FA] = useState((user as any)?.twofa_enabled ?? user?.twoFactorEnabled ?? false);
  
  useEffect(() => {
    setIs2FA((user as any)?.twofa_enabled ?? user?.twoFactorEnabled ?? false);
  }, [user]);

  const [show2FaModal, setShow2FaModal] = useState(false);
  const [show2FaDisableModal, setShow2FaDisableModal] = useState(false);
  const [qrData, setQrData] = useState<{ secret: string; qrCode: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState<string[]>(Array(6).fill(""));
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaStep, setTwoFaStep] = useState<"qr" | "otp">("qr");

  const handleTurnOn2FA = async () => {
    setTwoFaLoading(true);
    try {
      const data = await userApi.generate2FA();
      setQrData(data);
      setTwoFaStep("qr");
      setTwoFaCode(Array(6).fill(""));
      setShow2FaModal(true);
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    const codeStr = twoFaCode.join("");
    if (codeStr.length < 6) return toast("Enter 6 digit OTP", "warning");
    setTwoFaLoading(true);
    try {
      await userApi.verify2FA(codeStr);
      await refreshUser();
      setIs2FA(true);
      setShow2FaModal(false);
      toast("2FA Enabled Successfully", "success");
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    const codeStr = twoFaCode.join("");
    if (codeStr.length < 6) return toast("Enter 6 digit OTP", "warning");
    setTwoFaLoading(true);
    try {
      await userApi.disable2FA(codeStr);
      await refreshUser();
      setIs2FA(false);
      setShow2FaDisableModal(false);
      toast("2FA Disabled Successfully", "success");
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setTwoFaLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 40) }]} bounces={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={15} style={[styles.backBtn, { borderColor: colors.border }]}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.topSection}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Two-Factor Authentication</Text>
          <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>Add an extra layer of security to your account to prevent unauthorized access.</Text>
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.primaryPale }]}>
                <Feather name="shield" size={24} color={colors.primary} />
              </View>
              <View style={[styles.statusBadge, { backgroundColor: is2FA ? "rgba(159,232,112,0.15)" : "rgba(150,150,150,0.1)" }]}>
                <View style={[styles.statusDot, { backgroundColor: is2FA ? colors.primary : colors.mutedForeground }]} />
                <Text style={[styles.statusText, { color: is2FA ? colors.primary : colors.mutedForeground }]}>{is2FA ? "Enabled" : "Disabled"}</Text>
              </View>
            </View>
            
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Authenticator App</Text>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
              Use an app like Google Authenticator or Authy to generate time-based one-time passcodes (TOTP).
            </Text>

            <View style={styles.actionRow}>
              <PrimaryButton
                title={is2FA ? "Disable 2FA" : "Enable 2FA"}
                onPress={() => {
                  if (is2FA) {
                    setTwoFaCode(Array(6).fill(""));
                    setShow2FaDisableModal(true);
                  } else {
                    handleTurnOn2FA();
                  }
                }}
                loading={twoFaLoading && !show2FaModal && !show2FaDisableModal}
                variant={is2FA ? "secondary" : "primary"}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Enable 2FA Modal */}
      <Modal visible={show2FaModal} animationType="slide" transparent onRequestClose={() => setShow2FaModal(false)}>
        <View style={styles.modalOverlayFull}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Enable 2FA</Text>
              <Pressable onPress={() => setShow2FaModal(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>
            
            {twoFaStep === "qr" && qrData ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
                <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
                  1. Scan this QR code in your Authenticator app (e.g. Google Authenticator).
                </Text>
                <View style={styles.qrContainer}>
                  <Image source={{ uri: qrData.qrCode }} style={styles.qrImage} />
                </View>
                <Text style={[styles.sheetSub, { color: colors.mutedForeground, marginTop: 8 }]}>
                  Or enter this code manually:
                </Text>
                <Pressable onPress={() => { Clipboard.setStringAsync(qrData.secret); toast("Copied to clipboard", "success"); }} style={[styles.secretBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.secretText, { color: colors.foreground }]}>
                    {qrData.secret.length > 15 ? `${qrData.secret.slice(0, 18)}...${qrData.secret.slice(-5)}` : qrData.secret}
                  </Text>
                  <Feather name="copy" size={18} color={colors.primary} />
                </Pressable>
                
                <View style={{ marginTop: 32 }}>
                  <PrimaryButton title="Next Step" onPress={() => setTwoFaStep("otp")} />
                </View>
              </ScrollView>
            ) : (
              <View style={styles.sheetScroll}>
                <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
                  2. Enter the 6-digit code generated by your Authenticator app to verify setup.
                </Text>
                
                <View style={styles.otpWrapper}>
                  <OtpInput length={6} value={twoFaCode} onChange={setTwoFaCode} autoFocus />
                </View>

                <View style={{ marginTop: 32 }}>
                  <PrimaryButton title="Verify & Enable" onPress={handleVerify2FA} loading={twoFaLoading} />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Disable 2FA Modal */}
      <Modal visible={show2FaDisableModal} animationType="slide" transparent onRequestClose={() => setShow2FaDisableModal(false)}>
        <View style={styles.modalOverlayFull}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Disable 2FA</Text>
              <Pressable onPress={() => setShow2FaDisableModal(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>
            
            <View style={styles.sheetScroll}>
              <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
                Enter the 6-digit code from your Authenticator app to disable Two-Factor Authentication.
              </Text>
              
              <View style={styles.otpWrapper}>
                <OtpInput length={6} value={twoFaCode} onChange={setTwoFaCode} autoFocus />
              </View>

              <View style={{ marginTop: 32 }}>
                <PrimaryButton title="Disable 2FA" onPress={handleDisable2FA} loading={twoFaLoading} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: { paddingHorizontal: 24, marginBottom: 24, flexDirection: "row", alignItems: "center" },
  backBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  topSection: { paddingHorizontal: 24, marginBottom: 32 },
  pageTitle: { fontSize: 32, fontFamily: "Inter_700Bold", marginBottom: 12, letterSpacing: -1 },
  pageSub: { fontSize: 16, fontFamily: "Inter_400Regular", lineHeight: 24 },
  content: { paddingHorizontal: 24 },
  card: { borderWidth: 1, borderRadius: 24, padding: 24 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  iconBox: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  cardTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  cardDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, marginBottom: 32 },
  actionRow: { marginTop: "auto" },
  
  modalOverlayFull: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  bottomSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, borderTopWidth: 1, padding: 24, paddingTop: 12 },
  modalHandle: { width: 48, height: 4, borderRadius: 2, backgroundColor: "rgba(150,150,150,0.3)", alignSelf: "center", marginBottom: 24 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(150,150,150,0.1)", alignItems: "center", justifyContent: "center" },
  sheetScroll: { paddingBottom: 20 },
  sheetSub: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24, marginBottom: 20 },
  qrContainer: { alignItems: "center", marginBottom: 24, backgroundColor: "#fff", padding: 16, borderRadius: 24, alignSelf: "center" },
  qrImage: { width: 220, height: 220 },
  secretBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, padding: 16 },
  secretText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 15, letterSpacing: 1 },
  otpWrapper: { marginTop: 16, alignItems: "center", width: "100%" },
});
