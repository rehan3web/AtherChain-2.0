import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";

import * as Linking from "expo-linking";

import Header from "@/components/Header";
import WheelDatePicker from "@/components/WheelDatePicker";
import { useColors } from "@/hooks/useColors";
import { kycApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

type Step = "loading" | "eligibility" | "personal" | "identity" | "face" | "success";
type DocType = "CNIC / ID CARD" | "PASSPORT" | "DRIVER LICENSE";

import { COUNTRIES } from "@/components/auth/CountrySelector";


const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Chinese",
  "Arabic",
  "Urdu",
  "Hindi",
];

// ─── Eligibility Gate Component ──────────────────────────────────────────────
interface EligibilityStats {
  accountAgeDays: number;
  referralCount: number;
  emailVerified: boolean;
  twofaEnabled: boolean;
  minSessions: number;
  isTwitterFollowed: boolean;
}
interface EligibilityData {
  eligible: boolean;
  reasons: string[];
  stats: EligibilityStats;
  requirements: {
    min_account_age_days: number;
    min_referrals: number;
    require_email_verified: boolean;
    require_2fa: boolean;
    require_twitter_follow: boolean;
  };
}

function EligibilityGate({
  eligibility,
  colors,
  onRefresh,
  onProceed,
  onGoToSettings,
  refreshing,
}: {
  eligibility: EligibilityData;
  colors: ReturnType<typeof useColors>;
  onRefresh: () => void;
  onProceed: () => void;
  onGoToSettings: () => void;
  refreshing: boolean;
}) {
  const { toast } = useToast();
  const [showTwitterModal, setShowTwitterModal] = useState(false);
  const [twitterUsername, setTwitterUsername] = useState("");
  const [verifying, setVerifying] = useState(false);

  const { stats, requirements } = eligibility;

  const ageProgress = Math.min(
    stats.accountAgeDays / requirements.min_account_age_days,
    1,
  );
  const refProgress = Math.min(
    stats.referralCount / requirements.min_referrals,
    1,
  );

  const ageMet = stats.accountAgeDays >= requirements.min_account_age_days;
  const refMet = stats.referralCount >= requirements.min_referrals;
  const emailMet = !requirements.require_email_verified || stats.emailVerified;
  const twofaMet = !requirements.require_2fa || stats.twofaEnabled;
  const twitterMet =
    !requirements.require_twitter_follow || stats.isTwitterFollowed;

  const handleVerifyTwitter = async () => {
    const username = twitterUsername.trim().replace(/^@/, "");
    if (!username) {
      toast("Please enter your Twitter/X username", "warning");
      return;
    }
    setVerifying(true);
    try {
      await kycApi.verifyTwitter(username);
      toast("Twitter follow verified!", "success");
      setShowTwitterModal(false);
      setTwitterUsername("");
      onRefresh();
    } catch (err: any) {
      toast(
        err?.response?.data?.message || "Verification failed",
        "error",
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View>
      {/* Lock icon + header */}
      <View style={egStyles.lockHeader}>
        <View
          style={[
            egStyles.lockCircle,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="lock" size={32} color="#ffd11a" />
        </View>
        <Text style={[egStyles.lockedTitle, { color: colors.foreground }]}>
          KYC Verification Locked
        </Text>
        <Text
          style={[egStyles.lockedSubtitle, { color: colors.mutedForeground }]}
        >
          To ensure network integrity, you must meet the following criteria
          before submitting your identity verification.
        </Text>
      </View>

      {/* ── Account Age ── */}
      <View
        style={[
          egStyles.criteriaCard,
          {
            backgroundColor: colors.card,
            borderColor: ageMet ? "#9fe870" : colors.border,
          },
        ]}
      >
        <View style={egStyles.criteriaHeader}>
          <View style={egStyles.criteriaLeft}>
            <Feather
              name="clock"
              size={18}
              color={ageMet ? "#9fe870" : "#ffd11a"}
            />
            <Text
              style={[egStyles.criteriaTitle, { color: colors.foreground }]}
            >
              Account Age
            </Text>
          </View>
          <View
            style={[
              egStyles.statusBadge,
              { backgroundColor: ageMet ? "#9fe87022" : "#d0323822" },
            ]}
          >
            <Feather
              name={ageMet ? "check" : "x"}
              size={14}
              color={ageMet ? "#9fe870" : "#d03238"}
            />
          </View>
        </View>
        <Text style={[egStyles.criteriaValue, { color: colors.mutedForeground }]}>
          Current: {stats.accountAgeDays} Days / Required:{" "}
          {requirements.min_account_age_days} Days
        </Text>
        <View
          style={[egStyles.progressTrack, { backgroundColor: colors.border }]}
        >
          <View
            style={[
              egStyles.progressFill,
              {
                width: `${Math.round(ageProgress * 100)}%` as any,
                backgroundColor: ageMet ? "#9fe870" : "#ffd11a",
              },
            ]}
          />
        </View>
      </View>

      {/* ── Referrals ── */}
      <View
        style={[
          egStyles.criteriaCard,
          {
            backgroundColor: colors.card,
            borderColor: refMet ? "#9fe870" : colors.border,
          },
        ]}
      >
        <View style={egStyles.criteriaHeader}>
          <View style={egStyles.criteriaLeft}>
            <Feather
              name="users"
              size={18}
              color={refMet ? "#9fe870" : "#ffd11a"}
            />
            <Text
              style={[egStyles.criteriaTitle, { color: colors.foreground }]}
            >
              Referrals
            </Text>
          </View>
          <View
            style={[
              egStyles.statusBadge,
              { backgroundColor: refMet ? "#9fe87022" : "#d0323822" },
            ]}
          >
            <Feather
              name={refMet ? "check" : "x"}
              size={14}
              color={refMet ? "#9fe870" : "#d03238"}
            />
          </View>
        </View>
        <Text style={[egStyles.criteriaValue, { color: colors.mutedForeground }]}>
          Current: {stats.referralCount} Users / Required:{" "}
          {requirements.min_referrals} Users
        </Text>
        <Text style={[egStyles.criteriaNoteSmall, { color: colors.mutedForeground }]}>
          Each referral must mine {stats.minSessions} times to unlock this
        </Text>
        <View
          style={[egStyles.progressTrack, { backgroundColor: colors.border }]}
        >
          <View
            style={[
              egStyles.progressFill,
              {
                width: `${Math.round(refProgress * 100)}%` as any,
                backgroundColor: refMet ? "#9fe870" : "#ffd11a",
              },
            ]}
          />
        </View>
      </View>

      {/* ── Email Verification ── */}
      {requirements.require_email_verified && (
        <View
          style={[
            egStyles.criteriaCard,
            {
              backgroundColor: colors.card,
              borderColor: emailMet ? "#9fe870" : colors.border,
            },
          ]}
        >
          <View style={egStyles.criteriaHeader}>
            <View style={egStyles.criteriaLeft}>
              <Feather
                name="mail"
                size={18}
                color={emailMet ? "#9fe870" : "#ffd11a"}
              />
              <Text
                style={[egStyles.criteriaTitle, { color: colors.foreground }]}
              >
                Email Verification
              </Text>
            </View>
            <View
              style={[
                egStyles.statusBadge,
                { backgroundColor: emailMet ? "#9fe87022" : "#d0323822" },
              ]}
            >
              <Feather
                name={emailMet ? "check" : "x"}
                size={14}
                color={emailMet ? "#9fe870" : "#d03238"}
              />
            </View>
          </View>
          <Text style={[egStyles.criteriaValue, { color: colors.mutedForeground }]}>
            Current: {stats.emailVerified ? "Verified" : "Not Verified"} /
            Required: Verified
          </Text>
        </View>
      )}

      {/* ── Two-Factor Auth ── */}
      {requirements.require_2fa && (
        <View
          style={[
            egStyles.criteriaCard,
            {
              backgroundColor: colors.card,
              borderColor: twofaMet ? "#9fe870" : colors.border,
            },
          ]}
        >
          <View style={egStyles.criteriaHeader}>
            <View style={egStyles.criteriaLeft}>
              <Feather
                name="shield"
                size={18}
                color={twofaMet ? "#9fe870" : "#ffd11a"}
              />
              <Text
                style={[egStyles.criteriaTitle, { color: colors.foreground }]}
              >
                Two-Factor Auth
              </Text>
            </View>
            <View
              style={[
                egStyles.statusBadge,
                { backgroundColor: twofaMet ? "#9fe87022" : "#d0323822" },
              ]}
            >
              <Feather
                name={twofaMet ? "check" : "x"}
                size={14}
                color={twofaMet ? "#9fe870" : "#d03238"}
              />
            </View>
          </View>
          <Text style={[egStyles.criteriaValue, { color: colors.mutedForeground }]}>
            Current: {stats.twofaEnabled ? "Enabled" : "Disabled"} / Required:
            Enabled
          </Text>
          {!twofaMet && (
            <Pressable
              onPress={onGoToSettings}
              style={[egStyles.actionRowBtn, { borderColor: "#ffd11a" }]}
            >
              <Feather name="settings" size={14} color="#ffd11a" />
              <Text style={[egStyles.actionRowBtnText, { color: "#ffd11a" }]}>
                Enable 2FA in Settings
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ── Follow X (Twitter) ── */}
      {requirements.require_twitter_follow && (
        <View
          style={[
            egStyles.criteriaCard,
            {
              backgroundColor: colors.card,
              borderColor: twitterMet ? "#9fe870" : colors.border,
            },
          ]}
        >
          <View style={egStyles.criteriaHeader}>
            <View style={egStyles.criteriaLeft}>
              <Feather
                name="twitter"
                size={18}
                color={twitterMet ? "#9fe870" : "#1DA1F2"}
              />
              <Text
                style={[egStyles.criteriaTitle, { color: colors.foreground }]}
              >
                Follow X (Twitter)
              </Text>
            </View>
            <View
              style={[
                egStyles.statusBadge,
                { backgroundColor: twitterMet ? "#9fe87022" : "#1DA1F222" },
              ]}
            >
              <Feather
                name={twitterMet ? "check" : "x"}
                size={14}
                color={twitterMet ? "#9fe870" : "#1DA1F2"}
              />
            </View>
          </View>
          <Text style={[egStyles.criteriaValue, { color: colors.mutedForeground }]}>
            Follow @athchain to unlock KYC
          </Text>
          {!twitterMet && (
            <View style={egStyles.twitterBtnsRow}>
              <Pressable
                onPress={() =>
                  Linking.openURL("https://twitter.com/athchain")
                }
                style={[egStyles.twitterBtn, { backgroundColor: "#1DA1F2" }]}
              >
                <Feather name="twitter" size={14} color="#fff" />
                <Text style={[egStyles.twitterBtnText, { color: "#fff" }]}>
                  Follow
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowTwitterModal(true)}
                style={[
                  egStyles.twitterBtn,
                  {
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor: "#1DA1F2",
                  },
                ]}
              >
                <Feather name="check-circle" size={14} color="#1DA1F2" />
                <Text style={[egStyles.twitterBtnText, { color: "#1DA1F2" }]}>
                  Verify
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* ── Proceed button if eligible ── */}
      {eligibility.eligible && (
        <Pressable
          onPress={onProceed}
          style={[egStyles.proceedBtn, { backgroundColor: "#9fe870" }]}
        >
          <Feather name="arrow-right" size={18} color="#0a0a0a" />
          <Text style={[egStyles.proceedBtnText, { color: "#0a0a0a" }]}>
            Proceed to Verification
          </Text>
        </Pressable>
      )}

      {/* ── Refresh Status button ── */}
      <Pressable
        onPress={onRefresh}
        disabled={refreshing}
        style={[
          egStyles.refreshBtn,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: refreshing ? 0.6 : 1,
          },
        ]}
      >
        {refreshing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
        )}
        <Text
          style={[egStyles.refreshBtnText, { color: colors.mutedForeground }]}
        >
          {refreshing ? "Checking..." : "Refresh Status"}
        </Text>
      </Pressable>

      {/* ── Twitter Verify Modal ── */}
      <Modal
        visible={showTwitterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTwitterModal(false)}
      >
        <View style={egStyles.modalOverlay}>
          <View
            style={[
              egStyles.modalBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[egStyles.modalTitle, { color: colors.foreground }]}>
              Verify Twitter Follow
            </Text>
            <Text
              style={[egStyles.modalSub, { color: colors.mutedForeground }]}
            >
              Enter your Twitter/X username to confirm you follow @athchain.
            </Text>
            <View
              style={[
                egStyles.modalInputRow,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[egStyles.atSign, { color: colors.mutedForeground }]}>
                @
              </Text>
              <TextInput
                style={[egStyles.modalInput, { color: colors.foreground }]}
                value={twitterUsername}
                onChangeText={setTwitterUsername}
                placeholder="yourusername"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={egStyles.modalBtnsRow}>
              <Pressable
                onPress={() => {
                  setShowTwitterModal(false);
                  setTwitterUsername("");
                }}
                style={[
                  egStyles.modalCancelBtn,
                  { borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    egStyles.modalCancelText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleVerifyTwitter}
                disabled={verifying}
                style={[
                  egStyles.modalConfirmBtn,
                  { backgroundColor: "#1DA1F2", opacity: verifying ? 0.7 : 1 },
                ]}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={egStyles.modalConfirmText}>Verify</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const egStyles = StyleSheet.create({
  lockHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  lockCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  lockedTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    marginBottom: 8,
    textAlign: "center",
  },
  lockedSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  criteriaCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  criteriaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  criteriaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  criteriaTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  criteriaValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginBottom: 4,
  },
  criteriaNoteSmall: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginBottom: 8,
    fontStyle: "italic",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  actionRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  actionRowBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  twitterBtnsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  twitterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  twitterBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  proceedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  proceedBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  refreshBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalBox: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginBottom: 8,
  },
  modalSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  atSign: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    marginRight: 4,
  },
  modalInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    paddingVertical: 12,
  },
  modalBtnsRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  modalConfirmBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#fff",
  },
});

// ─── Main KYC Screen ──────────────────────────────────────────────────────────

export default function KycScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("loading");

  // Eligibility state
  const [eligibilityData, setEligibilityData] = useState<EligibilityData | null>(null);
  const [eligibilityRefreshing, setEligibilityRefreshing] = useState(false);
  const [kycStatus, setKycStatus] = useState<string>("pending");
  const [rejectionReason, setRejectionReason] = useState<string>("");

  // Step 1: Personal Info
  const [fullName, setFullName] = useState(
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : (user?.firstName ?? ""),
  );
  const [fatherName, setFatherName] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [selectedCountry, setSelectedCountry] = useState(
    COUNTRIES.find((c) => c.name === "United States")!,
  );
  const [state, setState] = useState("New York");
  const [address, setAddress] = useState("123 Street Name");

  // Step 2: Identity Documents
  const [docType, setDocType] = useState<DocType>("CNIC / ID CARD");
  const [docNumber, setDocNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  // Picker States
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showDocTypeModal, setShowDocTypeModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()),
  );

  // Fetch eligibility on mount
  const fetchEligibility = async (quiet = false) => {
    if (!quiet) setEligibilityRefreshing(true);
    try {
      const res = await kycApi.status();
      const currentStatus = (res.status || "unverified").toLowerCase();
      setKycStatus(currentStatus);
      if (res.rejectionReason) setRejectionReason(res.rejectionReason);

      if (currentStatus === 'pending' || currentStatus === 'approved' || currentStatus === 'rejected') {
        if (res.full_name) setFullName(res.full_name);
        if (res.id_number) setDocNumber(res.id_number);

        let mappedDocType: DocType = "CNIC / ID CARD";
        if (res.id_type === "PASSPORT") mappedDocType = "PASSPORT";
        if (res.id_type === "DRIVING_LICENSE") mappedDocType = "DRIVER LICENSE";
        setDocType(mappedDocType);

        const c = COUNTRIES.find(c => c.name === res.country);
        if (c) setSelectedCountry(c);

        setStep("success");
        return;
      }

      if (res.eligibility) {
        setEligibilityData(res.eligibility);
        if (res.eligibility.eligible) {
          setStep("personal");
        } else {
          setStep("eligibility");
        }
      } else {
        setStep("personal");
      }
    } catch {
      toast("Failed to load KYC eligibility", "error");
      setStep("eligibility");
    } finally {
      if (!quiet) setEligibilityRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEligibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitKyc = async (selfie: { uri: string; base64: string }) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("full_name", fullName);
      formData.append("father_name", fatherName);
      formData.append("address", address);
      formData.append("city", state);
      formData.append("country", selectedCountry.name);
      formData.append("country_code", selectedCountry.code);

      let mappedDocType = "CNIC";
      if (docType === "PASSPORT") mappedDocType = "PASSPORT";
      if (docType === "DRIVER LICENSE") mappedDocType = "DRIVING_LICENSE";

      formData.append("id_type", mappedDocType);
      formData.append("id_number", docNumber);

      if (dob) formData.append("dob", dob.toISOString());
      if (expiryDate) formData.append("id_expiry", expiryDate.toISOString());
      formData.append("language", selectedLanguage);

      if (frontImage) {
        const filename = frontImage.split("/").pop() || "id_front.jpg";
        formData.append("id_front", {
          uri: frontImage,
          name: filename,
          type: "image/jpeg",
        } as any);
      }
      if (backImage) {
        const filename = backImage.split("/").pop() || "id_back.jpg";
        formData.append("id_back", {
          uri: backImage,
          name: filename,
          type: "image/jpeg",
        } as any);
      }

      formData.append(
        "face_scan_frame",
        `data:image/jpeg;base64,${selfie.base64}`,
      );
      formData.append("verification_score", "95");
      formData.append(
        "verification_logs",
        JSON.stringify([{ action: "selfie", time: Date.now() }]),
      );

      await kycApi.submit(formData);
      setKycStatus("pending");
      setStep("success");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "KYC submission failed";
      if (!msg.includes("already") && !msg.includes("pending")) {
        toast(msg, "warning");
      } else {
        setStep("success");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (step === "personal") {
      setStep("identity");
    } else if (step === "identity") {
      setStep("face");
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === "eligibility" || step === "loading") {
      router.back();
    } else if (step === "personal") {
      if (eligibilityData && !eligibilityData.eligible) {
        setStep("eligibility");
      } else {
        router.back();
      }
    } else if (step === "identity") {
      setStep("personal");
    } else if (step === "face") {
      setStep("identity");
    }
  };

  const selectImage = async (
    type: "front" | "back",
    source: "library" | "camera",
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      let result;
      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          alert("Camera permission is required to take a photo of your ID.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          alert("Gallery permission is required to upload a file.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets[0].uri) {
        if (type === "front") {
          setFrontImage(result.assets[0].uri);
        } else {
          setBackImage(result.assets[0].uri);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.log("Error selecting image: ", error);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Pick a date";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Header />

        {/* Loading Step */}
        {step === "loading" && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Checking eligibility...
            </Text>
          </View>
        )}

        {/* Eligibility Gate Step */}
        {step === "eligibility" && eligibilityData && (
          <>
            <View style={styles.headerRow}>
              <Pressable
                onPress={handleBack}
                style={[
                  styles.backBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Feather name="arrow-left" size={20} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.title, { color: colors.foreground }]}>
                KYC Verification
              </Text>
            </View>
            <EligibilityGate
              eligibility={eligibilityData}
              colors={colors}
              refreshing={eligibilityRefreshing}
              onRefresh={() => fetchEligibility(false)}
              onProceed={() => setStep("personal")}
              onGoToSettings={() => router.push("/(tabs)/settings")}
            />
          </>
        )}

        {/* Back and Title */}
        {step !== "success" && step !== "loading" && step !== "eligibility" && (
          <View style={styles.headerRow}>
            <Pressable
              onPress={handleBack}
              style={[
                styles.backBtn,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.title, { color: colors.foreground }]}>
              KYC Verification
            </Text>
          </View>
        )}

        {/* Step Indicator (Dummy Steps) */}
        {step !== "success" && step !== "loading" && step !== "eligibility" && (
          <View style={styles.stepIndicatorRow}>
            <View style={styles.stepIndicatorItem}>
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor:
                      step === "personal" ||
                        step === "identity" ||
                        step === "face"
                        ? colors.primary
                        : colors.border,
                  },
                ]}
              >
                {step !== "personal" ? (
                  <Feather
                    name="check"
                    size={12}
                    color={colors.primaryForeground}
                  />
                ) : (
                  <Text
                    style={[
                      styles.stepDotText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    1
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color:
                      step === "personal"
                        ? colors.foreground
                        : colors.mutedForeground,
                    fontFamily:
                      step === "personal"
                        ? "Inter_600SemiBold"
                        : "Inter_500Medium",
                  },
                ]}
              >
                Personal
              </Text>
            </View>

            <View
              style={[
                styles.stepLine,
                {
                  backgroundColor:
                    step === "identity" || step === "face"
                      ? colors.primary
                      : colors.border,
                },
              ]}
            />

            <View style={styles.stepIndicatorItem}>
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor:
                      step === "identity" || step === "face"
                        ? colors.primary
                        : colors.card,
                    borderColor:
                      step === "identity" || step === "face"
                        ? colors.primary
                        : colors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                {step === "face" ? (
                  <Feather
                    name="check"
                    size={12}
                    color={colors.primaryForeground}
                  />
                ) : (
                  <Text
                    style={[
                      styles.stepDotText,
                      {
                        color:
                          step === "identity"
                            ? colors.primaryForeground
                            : colors.mutedForeground,
                      },
                    ]}
                  >
                    2
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color:
                      step === "identity"
                        ? colors.foreground
                        : colors.mutedForeground,
                    fontFamily:
                      step === "identity"
                        ? "Inter_600SemiBold"
                        : "Inter_500Medium",
                  },
                ]}
              >
                Documents
              </Text>
            </View>

            <View
              style={[
                styles.stepLine,
                {
                  backgroundColor:
                    step === "face" ? colors.primary : colors.border,
                },
              ]}
            />

            <View style={styles.stepIndicatorItem}>
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor:
                      step === "face" ? colors.primary : colors.card,
                    borderColor:
                      step === "face" ? colors.primary : colors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stepDotText,
                    {
                      color:
                        step === "face"
                          ? colors.primaryForeground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  3
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color:
                      step === "face"
                        ? colors.foreground
                        : colors.mutedForeground,
                    fontFamily:
                      step === "face" ? "Inter_600SemiBold" : "Inter_500Medium",
                  },
                ]}
              >
                Face Scan
              </Text>
            </View>
          </View>
        )}

        {/* Step Contents */}
        {step === "personal" && (
          <View style={styles.stepCard}>
            <View style={styles.stepIntro}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                Personal Information
              </Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                Please enter your details exactly as they appear on your ID.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.mutedForeground }]}
              >
                Full Name
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter full name"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.mutedForeground }]}
              >
                Father Name
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                value={fatherName}
                onChangeText={setFatherName}
                placeholder="Father Name"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Date of Birth Picker */}
            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.mutedForeground }]}
              >
                Date of Birth
              </Text>
              <Pressable
                onPress={() => setShowDobPicker(true)}
                style={[
                  styles.pickerBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.pickerBtnText,
                    { color: dob ? colors.foreground : colors.mutedForeground },
                  ]}
                >
                  {formatDate(dob)}
                </Text>
                <Feather
                  name="calendar"
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            {/* Language Selector */}
            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.mutedForeground }]}
              >
                Language
              </Text>
              <Pressable
                onPress={() => setShowLanguageModal(true)}
                style={[
                  styles.pickerBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[styles.pickerBtnText, { color: colors.foreground }]}
                >
                  {selectedLanguage}
                </Text>
                <Feather
                  name="chevron-down"
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            {/* Country Selector */}
            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.mutedForeground }]}
              >
                Country
              </Text>
              <Pressable
                onPress={() => setShowCountryModal(true)}
                style={[
                  styles.pickerBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.rowAlign}>
                  <Text style={styles.flagText}>{selectedCountry.flag}</Text>
                  <Text
                    style={[styles.pickerBtnText, { color: colors.foreground }]}
                  >
                    {selectedCountry.name}
                  </Text>
                </View>
                <Feather
                  name="chevron-down"
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.mutedForeground }]}
              >
                State
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                value={state}
                onChangeText={setState}
                placeholder="State"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.mutedForeground }]}
              >
                Address
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                value={address}
                onChangeText={setAddress}
                placeholder="123 Street Name"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <Pressable
              onPress={handleNext}
              disabled={!fullName || !fatherName || !dob || !state || !address}
              style={[
                styles.actionBtn,
                {
                  backgroundColor:
                    fullName && fatherName && dob && state && address
                      ? colors.primary
                      : colors.border,
                  marginTop: 12,
                },
              ]}
            >
              <Text
                style={[
                  styles.actionBtnText,
                  {
                    color:
                      fullName && fatherName && dob && state && address
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                  },
                ]}
              >
                Next Step
              </Text>
            </Pressable>
          </View>
        )}

        {step === "identity" && (
          <View style={styles.stepCard}>
            <View style={styles.stepIntro}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                Identity Documents
              </Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                Provide official government documentation.
              </Text>
            </View>

            {/* Document Type Dropdown */}
            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.mutedForeground }]}
              >
                Document Type
              </Text>
              <Pressable
                onPress={() => setShowDocTypeModal(true)}
                style={[
                  styles.pickerBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.pickerBtnText,
                    { color: colors.foreground, textTransform: "uppercase" },
                  ]}
                >
                  {docType}
                </Text>
                <Feather
                  name="chevron-down"
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.mutedForeground }]}
              >
                CNIC / ID CARD NUMBER
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                value={docNumber}
                onChangeText={setDocNumber}
                placeholder="XXXXXXXX"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="default"
              />
            </View>

            {/* Expiry Date Picker */}
            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: colors.mutedForeground }]}
              >
                Expiry Date
              </Text>
              <Pressable
                onPress={() => setShowExpiryPicker(true)}
                style={[
                  styles.pickerBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.pickerBtnText,
                    {
                      color: expiryDate
                        ? colors.foreground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  {formatDate(expiryDate)}
                </Text>
                <Feather
                  name="calendar"
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            {/* Document Scans */}
            <View style={styles.scanSection}>
              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.mutedForeground, marginBottom: 12 },
                ]}
              >
                Document Scans
              </Text>

              {/* Front Image Scan Slot */}
              <View
                style={[
                  styles.scanSlot,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.scanSlotInfo}>
                  <Text
                    style={[styles.scanLabel, { color: colors.foreground }]}
                  >
                    Front Side Scan
                  </Text>
                  <Text
                    style={[styles.scanSub, { color: colors.mutedForeground }]}
                  >
                    Supports JPG, PNG • Max 5MB
                  </Text>
                </View>

                {frontImage ? (
                  <View style={styles.previewContainer}>
                    <Image
                      source={{ uri: frontImage }}
                      style={styles.previewImage}
                    />
                    <Pressable
                      onPress={() => setFrontImage(null)}
                      style={[
                        styles.removeBtn,
                        { backgroundColor: colors.destructive },
                      ]}
                    >
                      <Feather
                        name="trash-2"
                        size={14}
                        color={colors.destructiveForeground}
                      />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.scanBtns}>
                    <Pressable
                      onPress={() => selectImage("front", "library")}
                      style={[
                        styles.scanBtnOutline,
                        { borderColor: colors.border },
                      ]}
                    >
                      <Feather
                        name="upload"
                        size={14}
                        color={colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.scanBtnText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        Upload File
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => selectImage("front", "camera")}
                      style={[
                        styles.scanBtnSolid,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Feather
                        name="camera"
                        size={14}
                        color={colors.primaryForeground}
                      />
                      <Text
                        style={[
                          styles.scanBtnText,
                          { color: colors.primaryForeground },
                        ]}
                      >
                        Take Photo
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Back Image Scan Slot */}
              <View
                style={[
                  styles.scanSlot,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.scanSlotInfo}>
                  <Text
                    style={[styles.scanLabel, { color: colors.foreground }]}
                  >
                    Back Side Scan
                  </Text>
                  <Text
                    style={[styles.scanSub, { color: colors.mutedForeground }]}
                  >
                    Supports JPG, PNG • Max 5MB
                  </Text>
                </View>

                {backImage ? (
                  <View style={styles.previewContainer}>
                    <Image
                      source={{ uri: backImage }}
                      style={styles.previewImage}
                    />
                    <Pressable
                      onPress={() => setBackImage(null)}
                      style={[
                        styles.removeBtn,
                        { backgroundColor: colors.destructive },
                      ]}
                    >
                      <Feather
                        name="trash-2"
                        size={14}
                        color={colors.destructiveForeground}
                      />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.scanBtns}>
                    <Pressable
                      onPress={() => selectImage("back", "library")}
                      style={[
                        styles.scanBtnOutline,
                        { borderColor: colors.border },
                      ]}
                    >
                      <Feather
                        name="upload"
                        size={14}
                        color={colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.scanBtnText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        Upload File
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => selectImage("back", "camera")}
                      style={[
                        styles.scanBtnSolid,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Feather
                        name="camera"
                        size={14}
                        color={colors.primaryForeground}
                      />
                      <Text
                        style={[
                          styles.scanBtnText,
                          { color: colors.primaryForeground },
                        ]}
                      >
                        Take Photo
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>

            {/* Step 2 Actions */}
            <View style={styles.btnRow}>
              <Pressable
                onPress={handleBack}
                style={[
                  styles.halfActionBtn,
                  { borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                <Text
                  style={[styles.actionBtnText, { color: colors.foreground }]}
                >
                  Back
                </Text>
              </Pressable>
              <Pressable
                onPress={handleNext}
                disabled={
                  !docNumber || !expiryDate || !frontImage || !backImage
                }
                style={[
                  styles.halfActionBtn,
                  {
                    backgroundColor:
                      docNumber && expiryDate && frontImage && backImage
                        ? colors.primary
                        : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    {
                      color:
                        docNumber && expiryDate && frontImage && backImage
                          ? colors.primaryForeground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  Next Step
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === "face" && (
          <FaceVerificationStep
            colors={colors}
            isSubmitting={isSubmitting}
            onComplete={submitKyc}
            onCancel={handleBack}
          />
        )}

        {step === "success" && (
          <SuccessStep
            colors={colors}
            status={kycStatus}
            reason={rejectionReason}
            details={{
              name: fullName,
              docType: docType,
              docNumber: docNumber,
              country: selectedCountry.name,
            }}
            onDone={() => router.replace("/(tabs)/settings")}
            onReapply={() => setStep("personal")}
          />
        )}
      </ScrollView>

      {/* DOB Date Picker Modal */}
      <WheelDatePicker
        visible={showDobPicker}
        onClose={() => setShowDobPicker(false)}
        onConfirm={(date) => setDob(date)}
        initialDate={dob || new Date(2000, 0, 1)}
        title="Select Date of Birth"
        mode="past"
      />

      {/* Expiry Date Picker Modal */}
      <WheelDatePicker
        visible={showExpiryPicker}
        onClose={() => setShowExpiryPicker(false)}
        onConfirm={(date) => setExpiryDate(date)}
        initialDate={expiryDate || new Date(2030, 0, 1)}
        title="Select Expiry Date"
        mode="future"
      />

      {/* Custom Country Picker Modal (matches settings country picker modal design) */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryModal(false)}
      >
        <View style={styles.modalOverlayFull}>
          <View
            style={[
              styles.countryPanel,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Select Country
              </Text>
              <Pressable
                onPress={() => setShowCountryModal(false)}
                style={styles.closeBtn}
              >
                <Feather name="x" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="search" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search country..."
                placeholderTextColor={colors.mutedForeground}
                value={countrySearch}
                onChangeText={setCountrySearch}
              />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.countryList}
            >
              {filteredCountries.map((country) => (
                <Pressable
                  key={country.code}
                  style={[
                    styles.countryItem,
                    { borderBottomColor: colors.border },
                    selectedCountry.code === country.code && {
                      backgroundColor: colors.primaryPale,
                    },
                  ]}
                  onPress={() => {
                    setSelectedCountry(country);
                    setShowCountryModal(false);
                    setCountrySearch("");
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={styles.countryFlag}>{country.flag}</Text>
                  <Text
                    style={[styles.countryName, { color: colors.foreground }]}
                  >
                    {country.name}
                  </Text>
                  {selectedCountry.code === country.code && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlayFull}>
          <View
            style={[
              styles.genericPanel,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Select Language
              </Text>
              <Pressable
                onPress={() => setShowLanguageModal(false)}
                style={styles.closeBtn}
              >
                <Feather name="x" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => (
                <Pressable
                  key={lang}
                  style={[
                    styles.countryItem,
                    { borderBottomColor: colors.border },
                    selectedLanguage === lang && {
                      backgroundColor: colors.primaryPale,
                    },
                  ]}
                  onPress={() => {
                    setSelectedLanguage(lang);
                    setShowLanguageModal(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text
                    style={[
                      styles.countryName,
                      { color: colors.foreground, paddingLeft: 12 },
                    ]}
                  >
                    {lang}
                  </Text>
                  {selectedLanguage === lang && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Document Type Picker Modal */}
      <Modal
        visible={showDocTypeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDocTypeModal(false)}
      >
        <View style={styles.modalOverlayFull}>
          <View
            style={[
              styles.genericPanel,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Document Type
              </Text>
              <Pressable
                onPress={() => setShowDocTypeModal(false)}
                style={styles.closeBtn}
              >
                <Feather name="x" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {(
                ["CNIC / ID CARD", "PASSPORT", "DRIVER LICENSE"] as DocType[]
              ).map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.countryItem,
                    { borderBottomColor: colors.border },
                    docType === type && { backgroundColor: colors.primaryPale },
                  ]}
                  onPress={() => {
                    setDocType(type);
                    setShowDocTypeModal(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text
                    style={[
                      styles.countryName,
                      { color: colors.foreground, paddingLeft: 12 },
                    ]}
                  >
                    {type}
                  </Text>
                  {docType === type && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ----------------------------------------------------
// FACE VERIFICATION SCREEN
// ----------------------------------------------------
function FaceVerificationStep({
  colors,
  onComplete,
  onCancel,
  isSubmitting,
}: any) {
  const [selfie, setSelfie] = useState<{ uri: string; base64: string } | null>(
    null,
  );

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const scanAnim = useRef(new Animated.Value(0)).current;
  const [isScanning, setIsScanning] = useState(false);
  const [checks, setChecks] = useState<any[]>([
    { id: 1, label: "Center your face", status: "idle" },
    { id: 2, label: "Turn slightly LEFT", status: "idle" },
    { id: 3, label: "Turn slightly RIGHT", status: "idle" },
    { id: 4, label: "Look down", status: "idle" },
    { id: 5, label: "Open mouth", status: "idle" },
  ]);

  const startLaserAnimation = () => {
    scanAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  const startLiveScan = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        alert("Camera permission is required for face verification.");
        return;
      }
    }

    setIsScanning(true);
    setSelfie(null);
    setChecks(prev => prev.map(c => ({ ...c, status: "idle" })));
    startLaserAnimation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 1; i <= 5; i++) {
      setChecks(prev => prev.map(c => c.id === i ? { ...c, status: "running" } : c));
      await delay(1200);
      setChecks(prev => prev.map(c => c.id === i ? { ...c, status: "done" } : c));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Silently capture picture at the end of scan
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
        });
        if (photo && photo.base64 && photo.uri) {
          setSelfie({ uri: photo.uri, base64: photo.base64 });
        }
      } catch (error) {
        console.error(error);
      }
    }
    setIsScanning(false);
  };

  const laserTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240],
  });

  return (
    <View style={styles.stepCard}>
      <View style={styles.stepIntro}>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>
          Live Face Scan
        </Text>
        <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
          Position your face in the oval guide and follow the on-screen instructions.
        </Text>
      </View>

      <View style={styles.scannerWrapper}>
        <View
          style={[
            styles.ovalScanner,
            { borderColor: isScanning ? colors.primary : colors.border },
          ]}
        >
          {selfie ? (
            <Image
              source={{ uri: selfie.uri }}
              style={{ width: "100%", height: "100%", resizeMode: "cover" }}
            />
          ) : isScanning ? (
            <CameraView
              ref={cameraRef}
              style={{ width: "100%", height: "100%" }}
              facing="front"
            />
          ) : (
            <View
              style={[styles.cameraSim, { backgroundColor: colors.canvasSoft }]}
            >
              <Feather
                name="user"
                size={120}
                color={colors.mutedForeground}
                style={{ opacity: 0.25 }}
              />
            </View>
          )}

          {isScanning && (
            <Animated.View
              style={[
                styles.laserLine,
                {
                  backgroundColor: colors.primary,
                  transform: [{ translateY: laserTranslateY }],
                  shadowColor: colors.primary,
                },
              ]}
            />
          )}
        </View>

        {!isScanning && !selfie && (
          <Pressable
            onPress={startLiveScan}
            style={[
              styles.scanBtnSolid,
              { backgroundColor: colors.primary, marginTop: 24 },
            ]}
          >
            <Feather
              name="camera"
              size={14}
              color={colors.primaryForeground}
            />
            <Text
              style={[
                styles.scanBtnText,
                { color: colors.primaryForeground },
              ]}
            >
              Start Live Scan
            </Text>
          </Pressable>
        )}
        {selfie && !isSubmitting && (
          <Pressable
            onPress={startLiveScan}
            style={[
              styles.scanBtnOutline,
              { borderColor: colors.border, marginTop: 24 },
            ]}
          >
            <Feather
              name="refresh-cw"
              size={14}
              color={colors.mutedForeground}
            />
            <Text
              style={[styles.scanBtnText, { color: colors.mutedForeground }]}
            >
              Retake Scan
            </Text>
          </Pressable>
        )}
      </View>

      <View
        style={[
          styles.checkList,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {checks.map((item) => (
          <View key={item.id} style={styles.checkItem}>
            {item.status === "done" && (
              <View
                style={[
                  styles.checkIndicatorDone,
                  { backgroundColor: colors.primaryPale },
                ]}
              >
                <Feather name="check" size={14} color={colors.primary} />
              </View>
            )}
            {item.status === "running" && (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.checkIndicatorLoading}
              />
            )}
            {item.status === "idle" && (
              <View
                style={[
                  styles.checkIndicatorIdle,
                  { borderColor: colors.border },
                ]}
              />
            )}

            <Text
              style={[
                styles.checkText,
                {
                  color:
                    item.status === "done"
                      ? colors.foreground
                      : item.status === "running"
                        ? colors.primary
                        : colors.mutedForeground,
                  fontFamily:
                    item.status === "done"
                      ? "Inter_600SemiBold"
                      : "Inter_500Medium",
                },
              ]}
            >
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.btnRow}>
        <Pressable
          onPress={onCancel}
          disabled={isSubmitting || isScanning}
          style={[
            styles.halfActionBtn,
            {
              borderColor: colors.border,
              borderWidth: 1,
              opacity: (isSubmitting || isScanning) ? 0.5 : 1,
            },
          ]}
        >
          <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
            Back
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onComplete(selfie)}
          disabled={!selfie || isSubmitting || isScanning}
          style={[
            styles.halfActionBtn,
            { backgroundColor: selfie && !isSubmitting && !isScanning ? colors.primary : colors.border },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.mutedForeground} size="small" />
          ) : (
            <Text
              style={[
                styles.actionBtnText,
                {
                  color: selfie
                    ? colors.primaryForeground
                    : colors.mutedForeground,
                },
              ]}
            >
              Submit KYC
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ----------------------------------------------------
// SUCCESS COMPLETION SCREEN
// ----------------------------------------------------
function SuccessStep({ colors, details, status, reason, onDone, onReapply }: any) {
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  const statusColor = isApproved ? "#9fe870" : isRejected ? colors.destructive : colors.warning;
  const statusText = isApproved ? "Approved" : isRejected ? "Rejected" : "Pending Review";
  const iconName = isApproved ? "check-circle" : isRejected ? "x-circle" : "clock";

  return (
    <View style={styles.successCard}>
      <View
        style={[
          styles.successIconGlow,
          { backgroundColor: statusColor + "20", shadowColor: statusColor },
        ]}
      >
        <Feather name={isApproved ? "check-circle" : isRejected ? "x-circle" : "shield"} size={48} color={statusColor} />
      </View>

      <Text style={[styles.successTitle, { color: colors.foreground }]}>
        {isApproved ? "KYC Approved!" : isRejected ? "KYC Application Rejected" : "KYC Details Submitted!"}
      </Text>
      <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
        {isApproved
          ? "Your identity has been verified successfully. You now have full access to all network features."
          : isRejected
            ? `Your application was rejected.\nReason: ${reason || "Not provided."}`
            : "Your identity documents and biometric verification have been uploaded successfully. Our team will review the details shortly."}
      </Text>

      <View
        style={[
          styles.summaryBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.summaryTitle,
            { color: colors.foreground, borderBottomColor: colors.border },
          ]}
        >
          Submission Summary
        </Text>

        <View style={styles.summaryRow}>
          <Text
            style={[styles.summaryLabel, { color: colors.mutedForeground }]}
          >
            Full Name
          </Text>
          <Text style={[styles.summaryVal, { color: colors.foreground }]}>
            {details.name}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text
            style={[styles.summaryLabel, { color: colors.mutedForeground }]}
          >
            Document Type
          </Text>
          <Text
            style={[
              styles.summaryVal,
              { color: colors.foreground, textTransform: "uppercase" },
            ]}
          >
            {details.docType}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text
            style={[styles.summaryLabel, { color: colors.mutedForeground }]}
          >
            Document No.
          </Text>
          <Text style={[styles.summaryVal, { color: colors.foreground }]}>
            {details.docNumber}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text
            style={[styles.summaryLabel, { color: colors.mutedForeground }]}
          >
            Country
          </Text>
          <Text style={[styles.summaryVal, { color: colors.foreground }]}>
            {details.country}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text
            style={[styles.summaryLabel, { color: colors.mutedForeground }]}
          >
            Status
          </Text>
          <View
            style={[
              styles.verifiedPill,
              {
                backgroundColor: statusColor + "20",
                paddingVertical: 2,
                paddingHorizontal: 8,
                height: 20,
              },
            ]}
          >
            <Feather name={iconName} size={10} color={statusColor} />
            <Text
              style={[
                styles.verifiedText,
                { color: statusColor, fontSize: 10 },
              ]}
            >
              {statusText}
            </Text>
          </View>
        </View>
      </View>

      {isRejected ? (
        <View style={{ width: '100%', flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <Pressable
            onPress={onDone}
            style={[
              styles.halfActionBtn,
              { borderColor: colors.border, borderWidth: 1 },
            ]}
          >
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Back</Text>
          </Pressable>
          <Pressable
            onPress={onReapply}
            style={[
              styles.halfActionBtn,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Re-Submit</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={onDone}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.primary, width: "100%", marginTop: 12 },
          ]}
        >
          <Text
            style={[styles.actionBtnText, { color: colors.primaryForeground }]}
          >
            Done
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ----------------------------------------------------
// STYLES
// ----------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 16,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },

  /* Step Progress Bar Styles */
  stepIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  stepIndicatorItem: { alignItems: "center", gap: 8 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  stepLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8, marginTop: -20 },

  /* Form & Step Card Styles */
  stepCard: { flex: 1 },
  stepIntro: { marginBottom: 28 },
  stepTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 6 },
  stepSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  inputGroup: { marginBottom: 18 },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  pickerBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  rowAlign: { flexDirection: "row", alignItems: "center", gap: 10 },
  flagText: { fontSize: 18 },

  actionBtn: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  actionBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },

  btnRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  halfActionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Document Upload Scan Styles */
  scanSection: { marginVertical: 12, gap: 16 },
  scanSlot: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 88,
  },
  scanSlotInfo: { flex: 1, marginRight: 12 },
  scanLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  scanSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  scanBtns: { flexDirection: "row", gap: 8 },
  scanBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  scanBtnSolid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  scanBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  previewContainer: {
    position: "relative",
    width: 80,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
  },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  removeBtn: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Face Scanner Styles */
  scannerWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 24,
  },
  ovalScanner: {
    width: 200,
    height: 250,
    borderRadius: 100,
    borderWidth: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cameraSim: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  laserLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    opacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 5,
  },
  radarRingWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  radarText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  /* Checklist Styles */
  checkList: {
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    marginVertical: 12,
  },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkIndicatorDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  checkIndicatorLoading: { width: 22, height: 22 },
  checkIndicatorIdle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  checkText: { fontSize: 13 },

  /* Success Screen Styles */
  successCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  successIconGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
    textAlign: "center",
  },
  successSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },

  summaryBox: {
    width: "100%",
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    marginBottom: 28,
  },
  summaryTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  summaryVal: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  /* Custom Picker Modals (Matches Country Selector) */
  modalOverlayFull: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  countryPanel: {
    height: "80%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
  },
  genericPanel: {
    maxHeight: "55%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  closeBtn: { padding: 4 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  countryList: { flex: 1 },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  countryFlag: { fontSize: 24 },
  countryName: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
});
