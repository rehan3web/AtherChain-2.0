import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useColors } from "@/hooks/useColors";
import { Web3KeyService } from "@/services/wallet/Web3KeyService";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

interface Web3OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (address: string) => void;
}

type Mode = "choice" | "create_display" | "create_verify" | "import" | "pin_setup";
type ImportTab = "mnemonic" | "privateKey";

export const Web3OnboardingModal: React.FC<Web3OnboardingModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const colors = useColors();
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || (user as any)?._id || "default_user";

  const [mode, setMode] = useState<Mode>("choice");

  // Create Wallet State
  const [wordCount, setWordCount] = useState<12 | 24>(12);
  const [mnemonic, setMnemonic] = useState<string>("");
  const [words, setWords] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<boolean>(false);

  // Verification State
  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [selectedVerifyWords, setSelectedVerifyWords] = useState<Record<number, string>>({});
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);

  // Import State
  const [importTab, setImportTab] = useState<ImportTab>("mnemonic");
  const [importMnemonicWords, setImportMnemonicWords] = useState<string[]>(Array(12).fill(""));
  const [importPrivateKey, setImportPrivateKey] = useState<string>("");
  const [derivationPath, setDerivationPath] = useState<string>("m/44'/60'/0'/0/0");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [importError, setImportError] = useState<string>("");

  // PIN Setup State
  const [pin, setPin] = useState<string>("");
  const [confirmPin, setConfirmPin] = useState<string>("");
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");
  const [pendingPrivateKey, setPendingPrivateKey] = useState<string>("");
  const [pendingMnemonic, setPendingMnemonic] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const startCreate = (count: 12 | 24) => {
    setWordCount(count);
    setImportError("");
    const phrase = Web3KeyService.generateMnemonic(count);
    setMnemonic(phrase);
    const arr = phrase.split(" ");
    setWords(arr);
    setRevealed(false);
    setMode("create_display");
  };

  const proceedToVerify = () => {
    setImportError("");
    setIsSubmitting(true);
    setTimeout(() => {
      if (!revealed) {
        const msg = "Please tap to reveal and back up your seed phrase first.";
        setImportError(msg);
        toast(msg, "warning");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIsSubmitting(false);
        return;
      }
      // Pick 3 random distinct indices
      const indices: number[] = [];
      while (indices.length < 3) {
        const idx = Math.floor(Math.random() * words.length);
        if (!indices.includes(idx)) indices.push(idx);
      }
      indices.sort((a, b) => a - b);
      setVerifyIndices(indices);
      setSelectedVerifyWords({});

      // Option choices: the 3 correct words + 5 random distractor words
      const targetWords = indices.map((i) => words[i]);
      const remaining = words.filter((w) => !targetWords.includes(w));
      const distractors = remaining.sort(() => 0.5 - Math.random()).slice(0, 5);
      const pool = [...targetWords, ...distractors].sort(() => 0.5 - Math.random());
      setShuffledOptions(pool);

      setIsSubmitting(false);
      setMode("create_verify");
    }, 350);
  };

  const handleVerifySelect = (word: string) => {
    setImportError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Find first unselected index
    const nextUnselected = verifyIndices.find((idx) => !selectedVerifyWords[idx]);
    if (nextUnselected !== undefined) {
      setSelectedVerifyWords((prev) => ({ ...prev, [nextUnselected]: word }));
    }
  };

  const handleVerifyDeselect = (idx: number) => {
    setImportError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedVerifyWords((prev) => {
      const copy = { ...prev };
      delete copy[idx];
      return copy;
    });
  };

  const checkVerifyAndProceed = () => {
    setImportError("");
    setIsSubmitting(true);
    setTimeout(() => {
      const isComplete = verifyIndices.every((idx) => selectedVerifyWords[idx]);
      if (!isComplete) {
        const msg = "Please select a word for all 3 positions.";
        setImportError(msg);
        toast(msg, "warning");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIsSubmitting(false);
        return;
      }

      const isCorrect = verifyIndices.every((idx) => selectedVerifyWords[idx] === words[idx]);
      if (!isCorrect) {
        const msg = "Incorrect word selection. Please double-check your seed phrase.";
        setImportError(msg);
        toast(msg, "error");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIsSubmitting(false);
        return;
      }

      try {
        const derived = Web3KeyService.deriveWalletFromMnemonic(mnemonic, derivationPath);
        setPendingMnemonic(mnemonic);
        setPendingPrivateKey(derived.privateKey);
        setPin("");
        setConfirmPin("");
        setPinStep("enter");
        setMode("pin_setup");
      } catch (err: any) {
        const msg = "Failed to derive wallet: " + err.message;
        setImportError(msg);
        toast(msg, "error");
      } finally {
        setIsSubmitting(false);
      }
    }, 350);
  };

  const handleCopyMnemonic = async () => {
    await Clipboard.setStringAsync(mnemonic);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast("Seed phrase copied to clipboard!", "success");
  };

  const startImport = () => {
    setImportMnemonicWords(Array(12).fill(""));
    setImportPrivateKey("");
    setImportError("");
    setMode("import");
  };

  const handlePasteImportMnemonic = async () => {
    setImportError("");
    const text = await Clipboard.getStringAsync();
    if (!text) return;
    const split = text.trim().toLowerCase().split(/\s+/);
    if (split.length >= 12) {
      const targetCount = split.length >= 24 ? 24 : 12;
      setWordCount(targetCount as 12 | 24);
      const newWords = Array(targetCount).fill("");
      split.forEach((w, idx) => {
        if (idx < targetCount) newWords[idx] = w;
      });
      setImportMnemonicWords(newWords);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(`Pasted & divided ${Math.min(split.length, targetCount)} words across boxes!`, "success");
    } else {
      const msg = "Clipboard text is not a valid 12 or 24 word phrase";
      setImportError(msg);
      toast(msg, "warning");
    }
  };

  const proceedFromImport = () => {
    setImportError("");
    setIsSubmitting(true);

    setTimeout(() => {
      if (importTab === "mnemonic") {
        const filledCount = importMnemonicWords.filter((w) => w.trim().length > 0).length;
        if (filledCount === 0) {
          const msg = `Please enter or paste your ${wordCount}-word seed phrase.`;
          setImportError(msg);
          toast(msg, "warning");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setIsSubmitting(false);
          return;
        }
        if (filledCount < wordCount) {
          const msg = `Please fill all ${wordCount} words. You have filled ${filledCount}/${wordCount}.`;
          setImportError(msg);
          toast(msg, "warning");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setIsSubmitting(false);
          return;
        }

        const phrase = importMnemonicWords.join(" ").trim();
        try {
          if (!Web3KeyService.validateMnemonic(phrase)) {
            const msg = "Invalid BIP-39 mnemonic phrase. Please check your word spelling.";
            setImportError(msg);
            toast(msg, "error");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setIsSubmitting(false);
            return;
          }
          const derived = Web3KeyService.deriveWalletFromMnemonic(phrase, derivationPath);
          setPendingMnemonic(phrase);
          setPendingPrivateKey(derived.privateKey);
          setPin("");
          setConfirmPin("");
          setPinStep("enter");
          setMode("pin_setup");
        } catch (err: any) {
          const msg = "Failed to derive wallet from seed phrase: " + err.message;
          setImportError(msg);
          toast(msg, "error");
        } finally {
          setIsSubmitting(false);
        }
      } else {
        if (!importPrivateKey.trim()) {
          const msg = "Please enter your private key.";
          setImportError(msg);
          toast(msg, "warning");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setIsSubmitting(false);
          return;
        }
        try {
          if (!Web3KeyService.validatePrivateKey(importPrivateKey)) {
            const msg = "Invalid 64-hex EVM Private Key. Must be 64 hexadecimal characters.";
            setImportError(msg);
            toast(msg, "error");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setIsSubmitting(false);
            return;
          }
          const derived = Web3KeyService.deriveWalletFromPrivateKey(importPrivateKey);
          setPendingMnemonic(null);
          setPendingPrivateKey(derived.privateKey);
          setPin("");
          setConfirmPin("");
          setPinStep("enter");
          setMode("pin_setup");
        } catch (err: any) {
          const msg = "Failed to derive wallet from private key: " + err.message;
          setImportError(msg);
          toast(msg, "error");
        } finally {
          setIsSubmitting(false);
        }
      }
    }, 350);
  };

  const handlePinKey = (num: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pinStep === "enter") {
      if (pin.length < 6) {
        const next = pin + num;
        setPin(next);
        if (next.length === 6) {
          setTimeout(() => setPinStep("confirm"), 200);
        }
      }
    } else {
      if (confirmPin.length < 6) {
        const next = confirmPin + num;
        setConfirmPin(next);
        if (next.length === 6) {
          if (next === pin) {
            saveWalletFinal(pin);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            toast("PINs do not match. Try again.", "error");
            setConfirmPin("");
          }
        }
      }
    }
  };

  const handlePinDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pinStep === "enter") {
      setPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const saveWalletFinal = async (finalPin: string) => {
    setIsSubmitting(true);
    try {
      const address = await Web3KeyService.saveWallet(
        userId,
        finalPin,
        pendingMnemonic,
        pendingPrivateKey,
        derivationPath
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast("Web3 Wallet setup complete!", "success");
      onSuccess(address);
    } catch (err: any) {
      toast("Failed to save wallet: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (mode === "choice") onClose();
              else setMode("choice");
            }}
            style={styles.backBtn}
          >
            <Feather name="x" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Web3 Wallet</Text>
          <View style={{ width: 40 }} />
        </View>

        {mode === "choice" && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.heroWrap}>
              <View style={[styles.heroIcon, { backgroundColor: colors.primaryPale }]}>
                <Feather name="shield" size={48} color={colors.primary} />
              </View>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>Non-Custodial Web3 Wallet</Text>
              <Text style={[styles.heroDesc, { color: colors.mutedForeground }]}>
                Take full control of your EVM assets across Ethereum, BSC, Polygon, Arbitrum, Base, Optimism & more.
              </Text>
            </View>

            <View style={styles.btnStack}>
              <Pressable
                onPress={() => startCreate(12)}
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="plus-circle" size={20} color={colors.primaryForeground} />
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Create New Wallet</Text>
              </Pressable>

              <Pressable
                onPress={startImport}
                style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Feather name="download" size={20} color={colors.foreground} />
                <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Import Existing Wallet</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}

        {mode === "create_display" && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Secret Recovery Phrase</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Write down these {wordCount} words in order and keep them safe. Never share them with anyone.
            </Text>

            {importError ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive }]}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{importError}</Text>
              </View>
            ) : null}

            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => startCreate(12)}
                style={[styles.toggleBadge, wordCount === 12 && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.toggleBadgeText, { color: wordCount === 12 ? colors.primaryForeground : colors.mutedForeground }]}>12 Words</Text>
              </Pressable>
              <Pressable
                onPress={() => startCreate(24)}
                style={[styles.toggleBadge, wordCount === 24 && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.toggleBadgeText, { color: wordCount === 24 ? colors.primaryForeground : colors.mutedForeground }]}>24 Words</Text>
              </Pressable>
            </View>

            <View style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.wordGrid}>
                {words.map((w, i) => (
                  <View key={i} style={[styles.wordChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.wordNum, { color: colors.mutedForeground }]}>{i + 1}.</Text>
                    <Text style={[styles.wordText, { color: colors.foreground }]}>{revealed ? w : "•••••"}</Text>
                  </View>
                ))}
              </View>

              {!revealed && (
                <Pressable onPress={() => setRevealed(true)} style={styles.revealOverlay}>
                  <Feather name="eye" size={24} color={colors.primary} />
                  <Text style={[styles.revealText, { color: colors.primary }]}>Tap to Reveal Phrase</Text>
                </Pressable>
              )}
            </View>

            {revealed && (
              <Pressable onPress={handleCopyMnemonic} style={styles.copyBtn}>
                <Feather name="copy" size={16} color={colors.primary} />
                <Text style={[styles.copyBtnText, { color: colors.primary }]}>Copy to Clipboard</Text>
              </Pressable>
            )}

            <Pressable
              onPress={proceedToVerify}
              disabled={isSubmitting}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>I Have Saved It</Text>
              )}
            </Pressable>
          </ScrollView>
        )}

        {mode === "create_verify" && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Verify Seed Phrase</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Tap the correct words for each position to confirm you backed them up.
            </Text>

            {importError ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive }]}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{importError}</Text>
              </View>
            ) : null}

            <View style={styles.verifySlotRow}>
              {verifyIndices.map((idx) => {
                const selected = selectedVerifyWords[idx];
                return (
                  <Pressable
                    key={idx}
                    onPress={() => selected && handleVerifyDeselect(idx)}
                    style={[
                      styles.verifySlot,
                      { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={[styles.slotNum, { color: colors.mutedForeground }]}>Word #{idx + 1}</Text>
                    <Text style={[styles.slotVal, { color: colors.foreground }]}>{selected || "Tap choice"}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.poolTitle, { color: colors.mutedForeground }]}>Select Words:</Text>
            <View style={styles.poolWrap}>
              {shuffledOptions.map((w, i) => {
                const isUsed = Object.values(selectedVerifyWords).includes(w);
                return (
                  <Pressable
                    key={i}
                    disabled={isUsed}
                    onPress={() => handleVerifySelect(w)}
                    style={[
                      styles.poolChip,
                      { backgroundColor: isUsed ? colors.border : colors.card, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.poolChipText, { color: isUsed ? colors.mutedForeground : colors.foreground }]}>{w}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={checkVerifyAndProceed}
              disabled={isSubmitting}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: colors.primary,
                  marginTop: 32,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Confirm & Set PIN</Text>
              )}
            </Pressable>
          </ScrollView>
        )}

        {mode === "import" && (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Import Existing Wallet</Text>

            {importError ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive }]}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{importError}</Text>
              </View>
            ) : null}

            <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Pressable
                onPress={() => setImportTab("mnemonic")}
                style={[styles.tabItem, importTab === "mnemonic" && { backgroundColor: colors.background }]}
              >
                <Text style={[styles.tabText, { color: importTab === "mnemonic" ? colors.foreground : colors.mutedForeground }]}>Seed Phrase</Text>
              </Pressable>
              <Pressable
                onPress={() => setImportTab("privateKey")}
                style={[styles.tabItem, importTab === "privateKey" && { backgroundColor: colors.background }]}
              >
                <Text style={[styles.tabText, { color: importTab === "privateKey" ? colors.foreground : colors.mutedForeground }]}>Private Key</Text>
              </Pressable>
            </View>

            {importTab === "mnemonic" ? (
              <View>
                <Pressable onPress={handlePasteImportMnemonic} style={styles.pasteImportBtn}>
                  <Feather name="clipboard" size={16} color={colors.primary} />
                  <Text style={[styles.pasteImportText, { color: colors.primary }]}>Paste 12/24 Word Phrase</Text>
                </Pressable>

                <View style={styles.importGrid}>
                  {importMnemonicWords.map((w, i) => (
                    <View key={i} style={[styles.importWordWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.importNum, { color: colors.mutedForeground }]}>{i + 1}</Text>
                      <TextInput
                        style={[styles.importInput, { color: colors.foreground }]}
                        value={w}
                        onChangeText={(val) => {
                          const split = val.trim().toLowerCase().split(/\s+/);
                          if (split.length > 1) {
                            const targetCount = split.length >= 24 ? 24 : 12;
                            setWordCount(targetCount as 12 | 24);
                            const newWords = Array(targetCount).fill("");
                            split.forEach((word, idx) => {
                              if (idx < targetCount) newWords[idx] = word;
                            });
                            setImportMnemonicWords(newWords);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            toast(`Divided ${Math.min(split.length, targetCount)} words across boxes!`, "success");
                          } else {
                            const copy = [...importMnemonicWords];
                            copy[i] = val.trim().toLowerCase();
                            setImportMnemonicWords(copy);
                          }
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>64-Hex Private Key (with or without 0x)</Text>
                <TextInput
                  style={[styles.pkInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="0x..."
                  placeholderTextColor={colors.mutedForeground}
                  value={importPrivateKey}
                  onChangeText={setImportPrivateKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                />
              </View>
            )}

            <Pressable onPress={() => setShowAdvanced(!showAdvanced)} style={styles.advancedToggle}>
              <Text style={[styles.advancedText, { color: colors.mutedForeground }]}>Advanced Settings</Text>
              <Feather name={showAdvanced ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
            </Pressable>

            {showAdvanced && (
              <View style={styles.advancedBox}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Derivation Path</Text>
                <TextInput
                  style={[styles.pathInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  value={derivationPath}
                  onChangeText={setDerivationPath}
                />
              </View>
            )}

            <Pressable
              onPress={proceedFromImport}
              disabled={isSubmitting}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Continue to PIN Setup</Text>
              )}
            </Pressable>
          </ScrollView>
        )}

        {mode === "pin_setup" && (
          <View style={[styles.content, { justifyContent: "center" }]}>
            <Text style={[styles.stepTitle, { color: colors.foreground, textAlign: "center" }]}>
              {pinStep === "enter" ? "Set 6-Digit Wallet PIN" : "Confirm 6-Digit Wallet PIN"}
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground, textAlign: "center" }]}>
              This PIN encrypts your Web3 private key on this device.
            </Text>

            <View style={styles.pinDotsRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const currentVal = pinStep === "enter" ? pin : confirmPin;
                const filled = i < currentVal.length;
                return (
                  <View
                    key={i}
                    style={[
                      styles.pinDot,
                      { backgroundColor: filled ? colors.primary : colors.border },
                    ]}
                  />
                );
              })}
            </View>

            {isSubmitting ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.keypadContainer}>
                {[
                  ["1", "2", "3"],
                  ["4", "5", "6"],
                  ["7", "8", "9"],
                  ["", "0", "del"],
                ].map((row, rIdx) => (
                  <View key={rIdx} style={styles.keypadRow}>
                    {row.map((k, kIdx) => {
                      if (!k) return <View key={kIdx} style={styles.keyItemEmpty} />;
                      return (
                        <Pressable
                          key={kIdx}
                          onPress={() => (k === "del" ? handlePinDelete() : handlePinKey(k))}
                          style={[styles.keyItem, { backgroundColor: colors.card }]}
                        >
                          {k === "del" ? (
                            <Feather name="delete" size={22} color={colors.foreground} />
                          ) : (
                            <Text style={[styles.keyText, { color: colors.foreground }]}>{k}</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  content: { padding: 24 },
  heroWrap: { alignItems: "center", marginVertical: 32 },
  heroIcon: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  heroTitle: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 10 },
  heroDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, paddingHorizontal: 16 },
  btnStack: { gap: 14, marginTop: 24 },
  primaryBtn: { height: 56, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  secondaryBtn: { height: 56, borderRadius: 28, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  secondaryBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },

  stepTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 8 },
  stepSub: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 20 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  toggleBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: "transparent" },
  toggleBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  gridCard: { padding: 16, borderRadius: 20, borderWidth: 1, position: "relative" },
  wordGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wordChip: { width: "31%", flexDirection: "row", alignItems: "center", padding: 8, borderRadius: 12, borderWidth: 1, gap: 4 },
  wordNum: { fontSize: 12, fontFamily: "Inter_400Regular" },
  wordText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  revealOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.85)", borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 8 },
  revealText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  copyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14 },
  copyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  verifySlotRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  verifySlot: { flex: 1, padding: 12, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 4 },
  slotNum: { fontSize: 11, fontFamily: "Inter_400Regular" },
  slotVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  poolTitle: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 10 },
  poolWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  poolChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1 },
  poolChipText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  tabBar: { flexDirection: "row", padding: 4, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12 },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pasteImportBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  pasteImportText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  importGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  importWordWrap: { width: "31%", flexDirection: "row", alignItems: "center", paddingHorizontal: 8, height: 40, borderRadius: 12, borderWidth: 1, gap: 4 },
  importNum: { fontSize: 11, fontFamily: "Inter_400Regular" },
  importInput: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", height: 40 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  pkInput: { borderRadius: 16, borderWidth: 1, padding: 14, fontSize: 14, fontFamily: "Inter_500Medium", height: 90 },
  advancedToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20 },
  advancedText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  advancedBox: { marginTop: 10, gap: 6 },
  pathInput: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_500Medium" },

  pinDotsRow: { flexDirection: "row", justifyContent: "center", gap: 16, marginVertical: 32 },
  pinDot: { width: 16, height: 16, borderRadius: 8 },
  keypadContainer: { width: "100%", maxWidth: 300, alignSelf: "center", marginTop: 20 },
  keypadRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginBottom: 14 },
  keyItem: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  keyItemEmpty: { width: 72, height: 72 },
  keyText: { fontSize: 26, fontFamily: "Inter_700Bold" },
});
