import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useWalletMode } from "@/contexts/WalletModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import Skeleton from "@/components/Skeleton";

import { EvmWalletProvider } from "@/services/wallet/EvmWalletProvider";
import { Web3KeyService } from "@/services/wallet/Web3KeyService";
import { TokenAsset, WalletTransaction } from "@/services/wallet/types";

import { Web3OnboardingModal } from "./Web3OnboardingModal";
import { NetworkSelectorModal } from "./NetworkSelectorModal";
import { AddCustomNetworkModal } from "./AddCustomNetworkModal";
import { ImportTokenModal } from "./ImportTokenModal";

import { Web3SendModal } from "./Web3SendModal";
import { Web3ReceiveModal } from "./Web3ReceiveModal";

type ActiveTab = "assets" | "transactions";

export const Web3WalletView: React.FC = () => {
  const colors = useColors();
  const router = useRouter();
  const { activeNetwork, setMode } = useWalletMode();
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || (user as any)?._id || "default_user";

  const [hasWeb3Wallet, setHasWeb3Wallet] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [address, setAddress] = useState("");

  const [activeTab, setActiveTab] = useState<ActiveTab>("assets");
  const [hideBalances, setHideBalances] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [tokens, setTokens] = useState<TokenAsset[]>([]);

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showNetworkSelector, setShowNetworkSelector] = useState(false);
  const [showAddCustomNetwork, setShowAddCustomNetwork] = useState(false);
  const [showImportToken, setShowImportToken] = useState(false);

  const [showSendModal, setShowSendModal] = useState(false);
  const [sendInitialToken, setSendInitialToken] = useState<TokenAsset | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  const provider = useMemo(() => new EvmWalletProvider(userId, activeNetwork), [userId, activeNetwork]);

  const checkWalletState = async () => {
    const exists = await Web3KeyService.hasWallet(userId);
    setHasWeb3Wallet(exists);
    if (exists) {
      const addr = await provider.getAddress();
      setAddress(addr);
      loadWalletData(addr);
    } else {
      setShowOnboarding(true);
    }
  };

  const loadWalletData = async (addr?: string) => {
    setLoading(true);
    try {
      const [tokList, txList] = await Promise.all([
        provider.getTokens(),
        provider.getHistory(),
      ]);
      setTokens(tokList);
      setTransactions(txList);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    checkWalletState();
  }, [activeNetwork]);

  useEffect(() => {
    if (!hasWeb3Wallet) return;
    const interval = setInterval(() => {
      loadWalletData();
    }, 30000);
    return () => clearInterval(interval);
  }, [hasWeb3Wallet, activeNetwork]);

  useEffect(() => {
    const pendingTxs = transactions.filter(t => t.status === "pending");
    pendingTxs.forEach(tx => {
      if (tx.txHash) {
        provider.waitForTransaction(tx.txHash).then(async (receipt) => {
          if (receipt) {
            await provider.updateTransaction(tx.txHash, { 
              status: receipt.status === 1 ? "confirmed" : "failed",
              metadata: { ...tx.metadata, blockNumber: receipt.blockNumber.toString() }
            });
            loadWalletData(address);
          }
        });
      }
    });
  }, [transactions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWalletData();
  };

  const nativeToken = tokens.find((t) => !t.address);
  const nativeBalance = nativeToken ? parseFloat(nativeToken.balance || "0") : 0;

  const handleCopyAddress = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast("Address copied to clipboard!", "success");
  };

  const cardGradient: readonly [string, string, string] = ["#163300", "#0e1a08", "#1a2e10"];

  if (hasWeb3Wallet === false && showOnboarding) {
    return (
      <Web3OnboardingModal
        visible={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onSuccess={(newAddr) => {
          setShowOnboarding(false);
          setHasWeb3Wallet(true);
          setAddress(newAddr);
          loadWalletData(newAddr);
        }}
      />
    );
  }

  const balanceParts = nativeBalance.toFixed(4).split(".");
  const balanceFull = balanceParts[0];
  const balanceDec = balanceParts[1] ?? "0000";

  return (
    <View style={styles.container}>
      {/* Top Header Row: Left = Switch Wallet Mode, Right = Network Selector */}
      <View style={styles.topHeaderRow}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setMode("aether");
          }}
          style={[styles.switchWalletBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="repeat" size={14} color={colors.primary} />
          <View style={[styles.modeMiniIcon, { backgroundColor: colors.primaryPale }]}>
            <Feather name="globe" size={13} color={colors.primary} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => setShowNetworkSelector(true)}
          style={[styles.networkPill, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.netDot} />
          <Text style={[styles.netName, { color: colors.foreground }]}>{activeNetwork.name}</Text>
          <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* AetherChain-Style Balance Card */}
        <View style={styles.cardWrap}>
          <LinearGradient colors={cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.balanceCard, { borderColor: colors.primaryNeutral }]}>
            <View style={styles.cardShine} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={styles.cardLabel}>Portfolio Value</Text>
              <Pressable onPress={() => setHideBalances(!hideBalances)}>
                <Feather name={hideBalances ? "eye-off" : "eye"} size={16} color="rgba(244,244,240,0.6)" />
              </Pressable>
            </View>

            {loading ? (
              <View style={{ marginVertical: 12 }}>
                <Skeleton width={180} height={46} borderRadius={8} style={{ marginBottom: 12 }} />
                <Skeleton width={50} height={18} borderRadius={4} />
              </View>
            ) : (
              <>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceBig}>{hideBalances ? "•••••" : balanceFull}</Text>
                  <Text style={styles.balanceCent}>.{hideBalances ? "••••" : balanceDec}</Text>
                </View>
                <Text style={[styles.balanceTicker, { color: colors.primary }]}>{activeNetwork.symbol}</Text>
              </>
            )}

            <View style={styles.cardDivider} />
            <View style={styles.cardStatsRow}>
              <View style={styles.cardStatCol}>
                <Text style={styles.secLabel}>Network</Text>
                <Text style={styles.secVal} numberOfLines={1}>{activeNetwork.name}</Text>
              </View>
              <View style={styles.vertDivider} />
              <View style={styles.cardStatCol}>
                <Text style={styles.secLabel}>Assets</Text>
                <Text style={styles.secVal}>{tokens.length} Tokens</Text>
              </View>
              <View style={styles.vertDivider} />
              <View style={styles.cardStatCol}>
                <Text style={styles.secLabel}>Address</Text>
                <Pressable onPress={handleCopyAddress}>
                  <Text style={[styles.secVal, { color: colors.primary }]} numberOfLines={1}>
                    {address ? `${address.slice(0, 5)}...${address.slice(-4)}` : "0x..."}
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.cardGlowCircle} />
          </LinearGradient>
        </View>

        {/* Main Action Buttons */}
        <View style={styles.mainActionsRow}>
          <Pressable
            onPress={() => {
              setSendInitialToken(tokens[0] || null);
              setShowSendModal(true);
            }}
            style={[styles.mainBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="arrow-up-right" size={18} color={colors.primaryForeground} />
            <Text style={[styles.mainBtnText, { color: colors.primaryForeground }]}>Send</Text>
          </Pressable>

          <Pressable
            onPress={() => setShowReceiveModal(true)}
            style={[styles.mainBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
          >
            <Feather name="arrow-down-left" size={18} color={colors.foreground} />
            <Text style={[styles.mainBtnText, { color: colors.foreground }]}>Receive</Text>
          </Pressable>

          <Pressable
            onPress={() => setShowImportToken(true)}
            style={[styles.mainBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
          >
            <Feather name="plus-circle" size={18} color={colors.foreground} />
            <Text style={[styles.mainBtnText, { color: colors.foreground }]}>Import</Text>
          </Pressable>
        </View>

        {/* Content Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab("assets"); }}
            style={[styles.tabButton, activeTab === "assets" && { backgroundColor: colors.background, elevation: 2 }]}
          >
            <Text style={[styles.tabButtonText, { color: activeTab === "assets" ? colors.foreground : colors.mutedForeground }]}>Assets</Text>
          </Pressable>


          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab("transactions"); }}
            style={[styles.tabButton, activeTab === "transactions" && { backgroundColor: colors.background, elevation: 2 }]}
          >
            <Text style={[styles.tabButtonText, { color: activeTab === "transactions" ? colors.foreground : colors.mutedForeground }]}>Transactions</Text>
          </Pressable>
        </View>

        {activeTab === "assets" && (
          <View style={styles.section}>
            {tokens.map((tok, i) => (
              <Pressable
                key={tok.address || i}
                onPress={() => {
                  router.push({
                    pathname: "/token-detail",
                    params: {
                      name: tok.name,
                      symbol: tok.symbol,
                      balance: tok.balance,
                      decimals: String(tok.decimals),
                      address: tok.address || "",
                      icon: tok.icon || "",
                      fiatValue: String(tok.fiatValue || 0),
                      change24h: String(tok.change24h || 0),
                      networkName: activeNetwork.name,
                    },
                  });
                }}
                style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.txIcon, { backgroundColor: colors.primaryPale, overflow: "hidden" }]}>
                  {tok.icon ? (
                    <Image source={{ uri: tok.icon }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.primary }}>{tok.symbol.slice(0, 3)}</Text>
                  )}
                </View>
                <View style={styles.txBody}>
                  <Text style={[styles.txName, { color: colors.foreground }]}>{tok.symbol}</Text>
                  <Text style={[styles.txSub, { color: colors.mutedForeground }]}>{tok.name}</Text>
                </View>
                <View style={styles.txEnd}>
                  <Text style={[styles.txAmount, { color: colors.foreground }]}>
                    {hideBalances ? "•••••" : tok.balance}
                  </Text>
                </View>
              </Pressable>
            ))}

            <Pressable
              onPress={() => setShowImportToken(true)}
              style={[styles.importBanner, { borderColor: colors.border }]}
            >
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={[styles.importBannerText, { color: colors.primary }]}>Import Custom Token</Text>
            </Pressable>
          </View>
        )}

        {activeTab === "transactions" && (
          <View style={styles.section}>
            {transactions.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="inbox" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No transactions on {activeNetwork.name} yet</Text>
              </View>
            ) : (
              transactions.map((tx) => (
                <Pressable 
                  key={tx.id} 
                  style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => {
                    import("expo-router").then(({ router }) => {
                      router.push({ 
                        pathname: "/receipt", 
                        params: { 
                          id: tx.id, 
                          amount: `-${tx.amount} ${tx.symbol}`, 
                          toAddress: tx.toAddress || "", 
                          fromAddress: tx.fromAddress || "", 
                          type: tx.type, 
                          date: tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : "", 
                          timestamp: tx.timestamp || "", 
                          status: tx.status ?? "completed", 
                          hash: tx.txHash,
                          fee: tx.fee ? `${tx.fee} ${activeNetwork.symbol}` : "",
                          blockNumber: tx.metadata?.blockNumber || (tx.status === "pending" ? "Pending" : "")
                        } 
                      });
                    });
                  }}
                >
                  <View style={[styles.txIcon, { backgroundColor: colors.destructive + "22" }]}>
                    <Feather name="arrow-up-right" size={16} color={colors.negative} />
                  </View>
                  <View style={styles.txBody}>
                    <Text style={[styles.txName, { color: colors.foreground }]}>Send {tx.symbol}</Text>
                    <Text style={[styles.txSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {tx.status === "pending" ? "Pending..." : (tx.txHash ? `${tx.txHash.slice(0, 16)}...` : "Completed")}
                    </Text>
                  </View>
                  <View style={styles.txEnd}>
                    <Text style={[styles.txAmount, { color: colors.negative }]}>-{parseFloat(tx.amount).toFixed(4)} {tx.symbol}</Text>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                      {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : ""}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <NetworkSelectorModal
        visible={showNetworkSelector}
        onClose={() => setShowNetworkSelector(false)}
        onOpenAddCustom={() => setShowAddCustomNetwork(true)}
      />

      <AddCustomNetworkModal
        visible={showAddCustomNetwork}
        onClose={() => setShowAddCustomNetwork(false)}
      />

      <ImportTokenModal
        visible={showImportToken}
        onClose={() => setShowImportToken(false)}
        onSuccess={loadWalletData}
      />



      <Web3SendModal
        visible={showSendModal}
        initialToken={sendInitialToken}
        onClose={() => setShowSendModal(false)}
        onSuccess={loadWalletData}
      />

      <Web3ReceiveModal
        address={address}
        visible={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  switchWalletBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 38, borderRadius: 19, borderWidth: 1 },
  modeMiniIcon: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  networkPill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, height: 38, borderRadius: 19, borderWidth: 1 },
  netDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#9fe870" },
  netName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  cardWrap: { marginBottom: 24, backgroundColor: "transparent", shadowColor: "#9fe870", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 0 },
  balanceCard: { borderRadius: 24, borderWidth: 1, padding: 24, overflow: "hidden" },
  cardShine: { position: "absolute", top: 0, left: 0, right: 0, height: 80, backgroundColor: "rgba(159,232,112,0.07)", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  cardGlowCircle: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(159,232,112,0.05)", right: -60, bottom: -60 },
  cardLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(244,244,240,0.6)", letterSpacing: 0.5 },
  balanceRow: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  balanceBig: { fontSize: 46, fontFamily: "Inter_700Bold", fontWeight: "700", color: "#f4f4f0", letterSpacing: -1.5, lineHeight: 52 },
  balanceCent: { fontSize: 24, fontFamily: "Inter_400Regular", color: "rgba(244,244,240,0.55)", paddingBottom: 4 },
  balanceTicker: { fontSize: 16, fontFamily: "Inter_600SemiBold", letterSpacing: 3, marginTop: 4, marginBottom: 18 },
  cardDivider: { height: 1, backgroundColor: "rgba(159,232,112,0.12)", marginBottom: 14 },
  cardStatsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardStatCol: { flex: 1, alignItems: "center" },
  vertDivider: { width: 1, height: 28, backgroundColor: "rgba(159,232,112,0.15)" },
  secLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(244,244,240,0.45)", marginBottom: 2 },
  secVal: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "rgba(244,244,240,0.85)" },

  mainActionsRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  mainBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 24 },
  mainBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  tabContainer: { flexDirection: "row", padding: 4, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12 },
  tabButtonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  section: { marginBottom: 24 },
  txCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 20, borderWidth: 1, marginBottom: 8, gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  txBody: { flex: 1, gap: 3 },
  txName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  txSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  txEnd: { alignItems: "flex-end", gap: 3 },
  txAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  txDate: { fontSize: 11, fontFamily: "Inter_400Regular" },

  importBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, marginTop: 8, borderRadius: 16, borderWidth: 1, borderStyle: "dashed" },
  importBannerText: { fontSize: 13, fontFamily: "Inter_500Medium" },



  emptyBox: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
