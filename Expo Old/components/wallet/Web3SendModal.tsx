import React, { useState, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ethers } from "ethers";

import Header from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { useWalletMode } from "@/contexts/WalletModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { EvmWalletProvider } from "@/services/wallet/EvmWalletProvider";
import { Web3KeyService } from "@/services/wallet/Web3KeyService";
import { TokenAsset, FeeEstimate } from "@/services/wallet/types";

import { AssetSelectionStep } from "./sendSteps/AssetSelectionStep";
import { RecipientStep } from "./sendSteps/RecipientStep";
import { AmountStep } from "./sendSteps/AmountStep";
import { GasFeeStep } from "./sendSteps/GasFeeStep";
import { ConfirmSummaryStep } from "./sendSteps/ConfirmSummaryStep";
import { PinVerificationStep } from "./sendSteps/PinVerificationStep";
import { Web3ReceiptStep } from "./sendSteps/Web3ReceiptStep";

interface Web3SendModalProps {
  visible: boolean;
  initialToken?: TokenAsset | null;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "asset" | "recipient" | "amount" | "gas" | "confirm" | "pin" | "broadcast";

export const Web3SendModal: React.FC<Web3SendModalProps> = ({
  visible,
  initialToken,
  onClose,
  onSuccess,
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeNetwork } = useWalletMode();
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || (user as any)?._id || "default_user";

  const [step, setStep] = useState<Step>("asset");
  const [recipient, setRecipient] = useState("");
  const [ensName, setEnsName] = useState("");
  const [isResolvingEns, setIsResolvingEns] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const [tokens, setTokens] = useState<TokenAsset[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenAsset | null>(null);
  const [amount, setAmount] = useState("");

  const [feeEstimates, setFeeEstimates] = useState<{ low: FeeEstimate; market: FeeEstimate; aggressive: FeeEstimate } | null>(null);
  const [selectedFee, setSelectedFee] = useState<FeeEstimate | null>(null);
  const [isEstimatingGas, setIsEstimatingGas] = useState(false);

  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [blockNumber, setBlockNumber] = useState("Pending");

  const [fromAddress, setFromAddress] = useState("");

  const provider = useMemo(() => new EvmWalletProvider(userId, activeNetwork), [userId, activeNetwork]);

  useEffect(() => {
    if (visible) {
      setStep("asset");
      setRecipient("");
      setAmount("");
      setPin("");
      setPinError(false);
      setIsConfirming(false);
      setTxHash("");
      setBlockNumber("Pending");
      loadInitialData();
    }
  }, [visible, activeNetwork]);

  const loadInitialData = async () => {
    const list = await provider.getTokens();
    setTokens(list);
    if (initialToken) {
      const match = list.find((t) => t.symbol === initialToken.symbol);
      setSelectedToken(match || list[0]);
    } else {
      setSelectedToken(list[0]);
    }
    
    const addr = await provider.getAddress();
    setFromAddress(addr);
  };

  const handleBack = () => {
    if (step === "asset") onClose();
    else if (step === "recipient") setStep("asset");
    else if (step === "amount") setStep("recipient");
    else if (step === "confirm") setStep("amount");
    else if (step === "pin") setStep("confirm");
  };

  const handleRecipientInput = async (text: string) => {
    setRecipient(text);
    const cleaned = text.trim();
    if (cleaned.endsWith(".eth") && activeNetwork.chainId === 1) {
      setIsResolvingEns(true);
      try {
        const ethProvider = new ethers.JsonRpcProvider("https://cloudflare-eth.com", 1, { staticNetwork: true });
        const resolved = await ethProvider.resolveName(cleaned);
        if (resolved) {
          setEnsName(cleaned);
          setRecipient(resolved);
        }
      } catch {
        /* silent */
      } finally {
        setIsResolvingEns(false);
      }
    }
  };

  const handlePasteRecipient = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        const clean = text.trim();
        handleRecipientInput(clean);
        const cleanStr = String(clean);
        const isValid = ethers.isAddress(cleanStr) || ethers.isAddress((cleanStr as string).toLowerCase());
        if (!isValid && !(cleanStr as string).endsWith(".eth")) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          toast("Invalid wallet address pasted.", "error");
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast("Address pasted from clipboard!", "success");
        }
      } else {
        toast("Clipboard is empty.", "warning");
      }
    } catch {
      toast("Failed to read clipboard.", "error");
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowScanner(false);
    let addr = data.trim();
    if (data.includes(":")) {
      addr = data.split(":")[1].split("?")[0].trim();
    }
    handleRecipientInput(addr);
    const addrStr = String(addr);
    const isValid = ethers.isAddress(addrStr) || ethers.isAddress((addrStr as string).toLowerCase());
    if (!isValid) {
      toast("Scanned QR code is not a valid EVM address.", "error");
    }
  };

  const proceedToAmount = () => {
    const clean = recipient.trim();
    if (!clean) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast("Please enter a recipient address.", "warning");
      return;
    }

    const cleanStr = String(clean);
    if ((cleanStr as string).endsWith(".eth") && activeNetwork.chainId === 1) {
      if (isResolvingEns) {
        toast("Resolving ENS domain... please wait", "warning");
        return;
      }
      if (!ensName && !ethers.isAddress(cleanStr)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        toast("Could not resolve ENS name to a valid address.", "error");
        return;
      }
    }

    const isValid = ethers.isAddress(cleanStr) || ethers.isAddress((cleanStr as string).toLowerCase());
    if (!isValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast("Invalid wallet address. Please check and try again.", "error");
      return;
    }

    try {
      if (ethers.isAddress((cleanStr as string).toLowerCase())) {
        const checksummed = ethers.getAddress((cleanStr as string).toLowerCase());
        setRecipient(checksummed);
      }
    } catch {}

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep("amount");
  };

  const proceedToGas = async () => {
    const cleanAmount = amount.replace(/,/g, ".");
    const amtNum = parseFloat(cleanAmount);
    const cleanBalance = (selectedToken?.balance || "0").replace(/,/g, "");
    const balNum = parseFloat(cleanBalance);

    if (isNaN(amtNum) || amtNum <= 0) {
      toast("Please enter a valid amount greater than zero.", "error");
      return;
    }
    if (amtNum > balNum) {
      toast(`Insufficient ${selectedToken?.symbol} balance.`, "error");
      return;
    }

    setIsEstimatingGas(true);
    try {
      const estimates = await provider.estimateFee({
        to: recipient,
        amount,
        tokenAddress: selectedToken?.address,
      });
      setFeeEstimates(estimates);
      setSelectedFee(estimates.market);
      setStep("confirm");
    } catch (err: any) {
      toast("Gas estimation failed: " + err.message, "error");
    } finally {
      setIsEstimatingGas(false);
    }
  };

  const proceedToConfirm = () => {
    setStep("confirm");
  };

  const proceedToPin = async () => {
    setIsConfirming(true);
    const bioPin = await Web3KeyService.getPinWithBiometrics(userId);
    if (bioPin) {
      setStep("pin");
      await executeBroadcast(bioPin, false);
    } else {
      setStep("pin");
    }
    setIsConfirming(false);
  };

  const handlePinKey = (num: string) => {
    if (pinError) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pin.length < 6) {
      const next = pin + num;
      setPin(next);
      if (next.length === 6) {
        executeBroadcast(next, true);
      }
    }
  };

  const executeBroadcast = async (userPin: string, shouldSaveBiometrics: boolean = false) => {
    const isValidPin = await Web3KeyService.verifyPin(userId, userPin);
    if (!isValidPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPinError(true);
      setTimeout(() => {
        setPinError(false);
        setPin("");
      }, 600);
      return;
    }

    if (shouldSaveBiometrics) {
      Web3KeyService.savePinWithBiometrics(userId, userPin).catch(() => {});
    }

    setIsBroadcasting(true);
    try {
      const hash = await provider.signAndSend({
        to: recipient,
        amount,
        tokenAddress: selectedToken?.address,
        feeEstimate: selectedFee!,
        pin: userPin,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTxHash(hash);
      setBlockNumber("Pending");
      setStep("broadcast");
      
      provider.waitForTransaction(hash).then(receipt => {
        if (receipt && receipt.blockNumber) {
          setBlockNumber(receipt.blockNumber.toString());
        }
      });
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast("Transaction failed: " + err.message, "error");
      setPin("");
      setStep("confirm");
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {step !== "broadcast" && <Header />}

          {step !== "broadcast" && (
            <View style={styles.headerRow}>
              <Pressable onPress={handleBack} style={styles.backBtn}>
                <Feather name="arrow-left" size={24} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.title, { color: colors.foreground }]}>Send Assets</Text>
              <View style={[styles.chainBadge, { backgroundColor: colors.primaryPale }]}>
                <Text style={[styles.chainBadgeText, { color: colors.primary }]}>{activeNetwork.name}</Text>
              </View>
            </View>
          )}

          {showScanner ? (
            <View style={{ height: 350, borderRadius: 20, overflow: "hidden", marginTop: 20 }}>
              {!permission?.granted ? (
                <View style={styles.permWrap}>
                  <Text style={[styles.permText, { color: colors.foreground }]}>Camera permission required to scan QR code</Text>
                  <Pressable onPress={requestPermission} style={[styles.permBtn, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: colors.primaryForeground, fontWeight: "700" }}>Grant Permission</Text>
                  </Pressable>
                </View>
              ) : (
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="back"
                  onBarcodeScanned={handleBarCodeScanned}
                >
                  <Pressable onPress={() => setShowScanner(false)} style={styles.closeScanBtn}>
                    <Feather name="x" size={24} color="#ffffff" />
                  </Pressable>
                </CameraView>
              )}
            </View>
          ) : (
            <View style={styles.stepContainer}>
              {step === "asset" && (
                <AssetSelectionStep
                  tokens={tokens}
                  onSelect={(tok) => {
                    setSelectedToken(tok);
                    setStep("recipient");
                  }}
                />
              )}

              {step === "recipient" && (
                <RecipientStep
                  recipient={recipient}
                  onChangeText={handleRecipientInput}
                  isResolvingEns={isResolvingEns}
                  ensName={ensName}
                  onPaste={handlePasteRecipient}
                  onScan={() => setShowScanner(true)}
                  onNext={proceedToAmount}
                  networkName={activeNetwork.name}
                />
              )}

              {step === "amount" && (
                <AmountStep
                  amount={amount}
                  setAmount={setAmount}
                  selectedToken={selectedToken}
                  isEstimatingGas={isEstimatingGas}
                  onNext={proceedToGas}
                />
              )}



              {step === "confirm" && (
                <ConfirmSummaryStep
                  amount={amount}
                  selectedToken={selectedToken}
                  networkName={activeNetwork.name}
                  networkSymbol={activeNetwork.symbol}
                  selectedFee={selectedFee}
                  recipient={recipient}
                  isConfirming={isConfirming}
                  onCancel={handleBack}
                  onConfirm={proceedToPin}
                />
              )}

              {step === "pin" && (
                <PinVerificationStep
                  pin={pin}
                  pinError={pinError}
                  isBroadcasting={isBroadcasting}
                  onKey={handlePinKey}
                  onDelete={() => setPin(pin.slice(0, -1))}
                />
              )}

              {step === "broadcast" && (
                <Web3ReceiptStep
                  amount={amount}
                  symbol={selectedToken?.symbol || "ATH"}
                  txHash={txHash}
                  toAddress={recipient}
                  fromAddress={fromAddress}
                  gasFee={`${selectedFee?.totalFeeNative} ${activeNetwork.symbol}`}
                  networkName={activeNetwork.name}
                  blockNumber={blockNumber}
                  onDone={() => {
                    onSuccess();
                    onClose();
                  }}
                />
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", flex: 1 },
  chainBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chainBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  stepContainer: { flex: 1 },
  permWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 },
  permText: { fontSize: 16, textAlign: "center" },
  permBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  closeScanBtn: { position: "absolute", top: 20, right: 20, padding: 10, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 20 },
});
