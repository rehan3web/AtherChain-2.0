import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, ScrollView, TextInput, Modal, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { userApi, extractError } from "@/services/api";

import { COUNTRIES } from "@/components/auth/CountrySelector";


export default function PersonalDetailsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user?.firstName ?? (user as any)?.first_name ?? "");
  const [editLastName, setEditLastName] = useState(user?.lastName ?? (user as any)?.last_name ?? "");
  const [savingName, setSavingName] = useState(false);

  const [showCountryModal, setShowCountryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(
    COUNTRIES.find((c) => c.name === (user?.country ?? "Pakistan")) ?? COUNTRIES.find(c => c.code === "PK")!
  );

  const handleSaveName = async () => {
    if (!editFirstName.trim()) return toast("First name is required", "error");
    setSavingName(true);
    try {
      await userApi.updateProfile({
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        country: user?.country ?? "Pakistan",
      });
      await refreshUser();
      setIsEditingName(false);
      toast("Name updated successfully", "success");
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setSavingName(false);
    }
  };

  const handleSelectCountry = async (country: any) => {
    setSelectedCountry(country);
    setShowCountryModal(false);
    setSearchQuery("");
    try {
      await userApi.updateProfile({
        firstName: user?.firstName ?? (user as any)?.first_name ?? "",
        lastName: user?.lastName ?? (user as any)?.last_name ?? "",
        country: country.name,
      });
      await refreshUser();
      toast("Country updated successfully", "success");
    } catch (err: any) {
      toast(extractError(err), "error");
    }
  };

  const handleCopy = async (field: string, text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    toast(`${field} copied to clipboard`, "success");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const name = `${user?.firstName || (user as any)?.first_name || ""} ${user?.lastName || (user as any)?.last_name || ""}`.trim() || "N/A";
  const username = user?.username || "N/A";
  const email = user?.email || "N/A";
  const country = user?.country || "N/A";

  const details = [
    { label: "Name", value: name },
    { label: "Username", value: username },
    { label: "Email", value: email },
    { label: "Country", value: country },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom, 40) }]} bounces={false}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={15}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.topSection}>
          <View style={styles.titleArea}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>
              Personal Details
            </Text>
          </View>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {details.map((item, index) => {
          const isCopied = copiedField === item.label;
          return (
            <View key={index} style={styles.referenceSection}>
              <View style={[styles.referenceCard, { backgroundColor: colors.card }]}>
                <View style={styles.referenceHeader}>
                  <View style={styles.referenceTitleGroup}>
                    <View style={styles.decorators}>
                      <View style={[styles.decoratorLine, { backgroundColor: colors.foreground }]} />
                      <View style={[styles.decoratorLine, { backgroundColor: colors.foreground }]} />
                      <View style={[styles.decoratorLine, { backgroundColor: colors.foreground }]} />
                    </View>
                    <Text style={[styles.referenceTitle, { color: colors.foreground }]}>
                      {item.label}
                    </Text>
                  </View>
                  {item.label === "Name" ? (
                    isEditingName ? (
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <Pressable onPress={() => setIsEditingName(false)} hitSlop={15}>
                          <Feather name="x" size={16} color={colors.destructive} />
                        </Pressable>
                        {savingName ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Pressable onPress={handleSaveName} hitSlop={15}>
                            <Feather name="check" size={16} color={colors.primary} />
                          </Pressable>
                        )}
                      </View>
                    ) : (
                      <Pressable onPress={() => setIsEditingName(true)} hitSlop={15} style={styles.copyBtn}>
                        <Feather name="edit-2" size={16} color={colors.foreground} />
                      </Pressable>
                    )
                  ) : item.label === "Country" ? (
                    <Pressable onPress={() => setShowCountryModal(true)} hitSlop={15} style={styles.copyBtn}>
                      <Feather name="edit-2" size={16} color={colors.foreground} />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => handleCopy(item.label, item.value)}
                      hitSlop={15}
                      style={styles.copyBtn}
                    >
                      <Feather name={isCopied ? "check" : "copy"} size={16} color={isCopied ? colors.primary : colors.foreground} />
                    </Pressable>
                  )}
                </View>

                {item.label === "Name" && isEditingName ? (
                  <View style={{ marginTop: 16, gap: 8 }}>
                    <TextInput
                      style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                      value={editFirstName}
                      onChangeText={setEditFirstName}
                      placeholder="First Name"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <TextInput
                      style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                      value={editLastName}
                      onChangeText={setEditLastName}
                      placeholder="Last Name"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                ) : (
                  <Text style={[styles.referenceHash, { color: colors.mutedForeground }]} selectable>
                    {item.value}
                  </Text>
                )}
              </View>
            </View>
          );
        })}

      </ScrollView>

      <Modal visible={showCountryModal} animationType="slide" transparent onRequestClose={() => setShowCountryModal(false)}>
        <View style={styles.modalOverlayFull}>
          <View style={[styles.countryPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Country</Text>
              <Pressable onPress={() => setShowCountryModal(false)} style={styles.closeBtn}>
                <Feather name="x" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="search" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search country..."
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.countryList}>
              {COUNTRIES.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((country) => (
                <Pressable
                  key={country.code}
                  style={[styles.countryItem, { borderBottomColor: colors.border }, selectedCountry.code === country.code && { backgroundColor: colors.primaryPale }]}
                  onPress={() => handleSelectCountry(country)}
                >
                  <Text style={styles.countryFlag}>{country.flag}</Text>
                  <Text style={[styles.countryName, { color: colors.foreground }]}>{country.name}</Text>
                  {selectedCountry.code === country.code && <Feather name="check" size={18} color={colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  header: { alignItems: "flex-start", marginBottom: 20 },
  backBtn: { padding: 4, marginLeft: -4 },
  
  topSection: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  titleArea: { flex: 1, paddingRight: 16 },
  pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", lineHeight: 34 },
  
  separator: { height: 1, marginTop: 16, marginBottom: 24 },
  
  referenceSection: { marginBottom: 16 },
  referenceCard: { borderRadius: 16, padding: 20 },
  referenceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  referenceTitleGroup: { flexDirection: "row", alignItems: "center", gap: 12 },
  decorators: { gap: 3 },
  decoratorLine: { height: 1.5, width: 14, borderRadius: 1 },
  referenceTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", lineHeight: 16 },
  copyBtn: { marginTop: 0 },
  referenceHash: { marginTop: 16, fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 18, paddingRight: 24 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 16, fontFamily: "Inter_500Medium" },
  modalOverlayFull: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  countryPanel: { height: "80%", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  closeBtn: { padding: 4 },
  searchBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 48, marginBottom: 16 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, fontFamily: "Inter_500Medium" },
  countryList: { flex: 1 },
  countryItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  countryFlag: { fontSize: 24, marginRight: 16 },
  countryName: { flex: 1, fontSize: 16, fontFamily: "Inter_500Medium" },
});
