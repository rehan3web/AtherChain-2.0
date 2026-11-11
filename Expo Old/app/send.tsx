import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import Header from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { walletApi, extractError } from "@/services/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

type Step = "method" | "recipient" | "amount" | "confirm";
type Method = "username" | "email" | "address";

export default function SendScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const myAddress = user?.walletAddress || (user as any)?.address || "Unknown";

  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<Method>("address");
  const [recipient, setRecipient] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [athBalance, setAthBalance] = useState("0.0000");
  const [isLoading, setIsLoading] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  useEffect(() => {
    walletApi.stats().then((stats) => {
      setAthBalance(stats?.ath_balance ?? "0.0000");
    }).catch(() => {});
  }, []);

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === "method") {
      setStep("recipient");
    } else if (step === "recipient") {
      if (!recipient.trim()) return;
      if (method !== "address") {
        setIsLookingUp(true);
        try {
          const result = await walletApi.lookup(recipient.trim());
          setResolvedAddress(result?.address ?? recipient.trim());
        } catch {
          setResolvedAddress(recipient.trim());
        } finally {
          setIsLookingUp(false);
        }
      } else {
        setResolvedAddress(recipient.trim());
      }
      setStep("amount");
    } else if (step === "amount") {
      setStep("confirm");
    }
  };

  const handleBack = () => {
    if (step === "method") router.back();
    else if (step === "recipient") setStep("method");
    else if (step === "amount") setStep("recipient");
    else if (step === "confirm") setStep("amount");
  };

  const handleConfirm = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast("Please enter a valid amount.", "warning");
      return;
    }
    if (amountNum > parseFloat(athBalance)) {
      toast(`Insufficient balance. You only have ${athBalance} ATH.`, "error");
      return;
    }

    setIsLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const result = await walletApi.send(resolvedAddress || recipient, amountNum);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/receipt",
        params: {
          amount: `-${amount} ATH`,
          toAddress: resolvedAddress || recipient,
          fromAddress: myAddress,
          type: "send",
          hash: result?.hash ?? "",
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          status: "completed",
        },
      });
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast(extractError(err), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <Header />

        <View style={styles.headerRow}>
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Send Assets</Text>
        </View>

        {step === "method" && (
          <MethodStep colors={colors} selected={method} onSelect={(m: Method) => { setMethod(m); handleNext(); }} />
        )}
        {step === "recipient" && (
          <RecipientStep colors={colors} method={method} value={recipient} onChange={setRecipient} onNext={handleNext} isLookingUp={isLookingUp} />
        )}
        {step === "amount" && (
          <AmountStep colors={colors} value={amount} onChange={setAmount} onNext={handleNext} balance={athBalance} />
        )}
        {step === "confirm" && (
          <ConfirmStep colors={colors} method={method} recipient={recipient} amount={amount} onConfirm={handleConfirm} onCancel={handleBack} isLoading={isLoading} />
        )}
      </ScrollView>
    </View>
  );
}

function MethodStep({ colors, selected, onSelect }: any) {
  const methods = [
    { id: "username", label: "Username", icon: "user", desc: "Send to a username" },
    { id: "email", label: "Email", icon: "mail", desc: "Send to an email address" },
    { id: "address", label: "Wallet Address", icon: "hash", desc: "Send to a wallet address" },
  ];
  return (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Choose a Method</Text>
      <View style={styles.methodList}>
        {methods.map((m) => (
          <Pressable key={m.id} onPress={() => onSelect(m.id)} style={[styles.methodItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.methodIcon, { backgroundColor: colors.primaryPale }]}>
              <Feather name={m.icon as any} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.methodLabel, { color: colors.foreground }]}>{m.label}</Text>
              <Text style={[styles.methodDesc, { color: colors.mutedForeground }]}>{m.desc}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RecipientStep({ colors, method, value, onChange, onNext, isLookingUp }: any) {
  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        onChange(text.trim());
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {}
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Enter {method.charAt(0).toUpperCase() + method.slice(1)}</Text>
      <View style={styles.minimalInputContainer}>
        <View style={[styles.inputRowContainer, { borderBottomColor: colors.border }]}>
          <TextInput
            style={[styles.minimalInput, { color: colors.foreground }]}
            placeholder={`Enter recipient ${method}...`}
            placeholderTextColor={colors.mutedForeground}
            value={value}
            onChangeText={onChange}
            autoFocus
            autoCapitalize="none"
            keyboardType={method === "email" ? "email-address" : "default"}
          />
          <View style={styles.inputActionIcons}>
            <Pressable onPress={handlePaste} style={styles.iconActionBtn} hitSlop={8}>
              <Feather name="clipboard" size={20} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>
      <Pressable
        onPress={onNext}
        disabled={!value || isLookingUp}
        style={[styles.nextBtn, { backgroundColor: (value && !isLookingUp) ? colors.primary : colors.border }]}
      >
        {isLookingUp ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.nextBtnText, { color: value ? colors.primaryForeground : colors.mutedForeground }]}>Next</Text>
        )}
      </Pressable>
    </View>
  );
}

function AmountStep({ colors, value, onChange, onNext, balance }: any) {
  const isValid = value && parseFloat(value) > 0 && parseFloat(value) <= parseFloat(balance);
  return (
    <View style={styles.stepContainer}>
      <View style={styles.availableRow}>
        <Text style={[styles.availableLabel, { color: colors.mutedForeground }]}>Available </Text>
        <Text style={[styles.availableAmount, { color: colors.primary }]}>{parseFloat(balance).toFixed(4)} ATH</Text>
        <Pressable onPress={() => onChange(balance)}>
          <Text style={[styles.maxBtnText, { color: colors.primary }]}>MAX</Text>
        </Pressable>
      </View>
      <View style={styles.bigInputContainer}>
        <TextInput
          style={[styles.bigInput, { color: colors.foreground }]}
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={onChange}
          autoFocus
        />
        <Text style={[styles.tickerLabel, { color: colors.mutedForeground }]}>ATH</Text>
      </View>
      {value && parseFloat(value) > parseFloat(balance) && (
        <Text style={[styles.errorText, { color: colors.negative }]}>Insufficient balance</Text>
      )}
      <Pressable onPress={onNext} disabled={!isValid} style={[styles.nextBtn, { backgroundColor: isValid ? colors.primary : colors.border }]}>
        <Text style={[styles.nextBtnText, { color: isValid ? colors.primaryForeground : colors.mutedForeground }]}>Next Step</Text>
      </Pressable>
    </View>
  );
}

function ConfirmStep({ colors, method, recipient, amount, onConfirm, onCancel, isLoading }: any) {
  return (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Confirm Transfer</Text>
      <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.confirmRow}>
          <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>Amount</Text>
          <Text style={[styles.confirmVal, { color: colors.foreground }]}>{amount} ATH</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>Method</Text>
          <Text style={[styles.confirmVal, { color: colors.foreground, textTransform: "capitalize" }]}>{method}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>Network Fee</Text>
          <Text style={[styles.confirmVal, { color: colors.positive }]}>Free</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>To</Text>
          <Text style={[styles.confirmVal, { color: colors.foreground }]} numberOfLines={1}>{recipient}</Text>
        </View>
      </View>
      <View style={styles.btnRow}>
        <Pressable onPress={onCancel} style={[styles.halfBtn, { borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.halfBtnText, { color: colors.foreground }]}>Cancel</Text>
        </Pressable>
        <Pressable onPress={onConfirm} disabled={isLoading} style={[styles.halfBtn, { backgroundColor: colors.primary }]}>
          {isLoading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.halfBtnText, { color: colors.primaryForeground }]}>Confirm</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 32 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  stepContainer: { flex: 1 },
  stepTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 20 },
  methodList: { gap: 12 },
  methodItem: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, borderWidth: 1, gap: 12 },
  methodIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  methodLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  methodDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  minimalInputContainer: { marginBottom: 32 },
  inputRowContainer: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingVertical: 4 },
  minimalInput: { flex: 1, fontSize: 16, fontFamily: "Inter_500Medium", paddingVertical: 10, paddingRight: 8 },
  inputActionIcons: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconActionBtn: { padding: 6, borderRadius: 8 },
  availableRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  availableLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  availableAmount: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  maxBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  bigInputContainer: { flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 12 },
  bigInput: { fontSize: 64, fontFamily: "Inter_700Bold" },
  tickerLabel: { fontSize: 24, fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 16 },
  nextBtn: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginTop: 24 },
  nextBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  confirmCard: { padding: 20, borderRadius: 24, borderWidth: 1, gap: 16, marginBottom: 40 },
  confirmRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  confirmLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  confirmVal: { fontSize: 14, fontFamily: "Inter_600SemiBold", maxWidth: "60%" },
  btnRow: { flexDirection: "row", gap: 12 },
  halfBtn: { flex: 1, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  halfBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
