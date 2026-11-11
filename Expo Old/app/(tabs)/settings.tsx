import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { Passkey } from "react-native-passkey";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { userApi, authApi, extractError } from "@/services/api";
import { useToast } from "@/contexts/ToastContext";

type Tab = "profile" | "security" | "password";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profilePic, signOut, refreshUser, updateProfilePicState } = useAuth();
  const { toast } = useToast();

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [refreshUser])
  );

  const handleChoosePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        toast("Gallery permission is required to upload a profile picture.", "error");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        setPhotoLoading(true);
        const selectedAsset = result.assets[0];
        
        await userApi.uploadProfileImage(selectedAsset.uri);
        
        const base64Uri = "data:image/jpeg;base64," + selectedAsset.base64;
        await updateProfilePicState(base64Uri);
        
        await refreshUser();
        toast("Profile picture updated.", "success");
      }
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setPhotoLoading(false);
    }
  };

  const initials = `${(user?.firstName ?? "U")[0] ?? "U"}${(user?.lastName ?? "")[0] ?? ""}`.toUpperCase();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={[styles.scroll, { width: "100%" }]}
        contentContainerStyle={{
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.newHeader}>
          <View style={styles.newAvatarContainer}>
            <View style={styles.newAvatarCircle}>
              {profilePic ? (
                <Image source={{ uri: profilePic }} style={{ width: "100%", height: "100%", borderRadius: 40 }} />
              ) : (
                <Text style={styles.newAvatarInitials}>{initials}</Text>
              )}
            </View>
            <Pressable style={[styles.newEditIconContainer, { backgroundColor: colors.background }]} onPress={handleChoosePhoto} disabled={photoLoading}>
              {photoLoading ? <ActivityIndicator size={12} color={colors.primary} /> : <Feather name="edit-2" size={12} color={colors.foreground} />}
            </Pressable>
          </View>
          <View style={styles.newHeaderInfo}>
            <Text style={[styles.newHeaderName, { color: colors.foreground }]}>{user?.firstName || user?.username || "Ather Chain"}</Text>
            <Text style={[styles.newHeaderHandle, { color: colors.mutedForeground }]}>@{user?.username || "atherchain"}</Text>
          </View>
        </View>

        <View style={styles.newListContainer}>
          <Text style={[styles.newSectionTitle, { color: colors.foreground }]}>Account</Text>
          <View style={styles.newCard}>
            <Pressable style={styles.newListItem} onPress={() => router.push("/personal-details")}>
              <View style={styles.newListItemIcon}><Feather name="user" size={20} color={colors.foreground} /></View>
              <Text style={[styles.newListItemText, { color: colors.foreground }]}>Personal Information</Text>
              <Feather name="chevron-right" size={20} color={colors.foreground} />
            </Pressable>
            <View style={styles.newDividerContainer}><View style={[styles.newDivider, { backgroundColor: colors.border }]} /></View>
            <Pressable style={styles.newListItem} onPress={() => router.push("/kyc")}>
              <View style={styles.newListItemIcon}><Feather name="user-check" size={20} color={colors.foreground} /></View>
              <Text style={[styles.newListItemText, { color: colors.foreground }]}>KYC Verification</Text>
              <Feather name="chevron-right" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <Text style={[styles.newSectionTitle, { marginTop: 40, color: colors.foreground }]}>Security</Text>
          <View style={styles.newCard}>
            <Pressable style={styles.newListItem} onPress={() => router.push("/sessions")}>
              <View style={styles.newListItemIcon}><Feather name="monitor" size={20} color={colors.foreground} /></View>
              <Text style={[styles.newListItemText, { color: colors.foreground }]}>Sessions</Text>
              <Feather name="chevron-right" size={20} color={colors.foreground} />
            </Pressable>
            <View style={styles.newDividerContainer}><View style={[styles.newDivider, { backgroundColor: colors.border }]} /></View>
            <Pressable style={styles.newListItem} onPress={() => router.push("/two-fa")}>
              <View style={styles.newListItemIcon}><Feather name="shield" size={20} color={colors.foreground} /></View>
              <Text style={[styles.newListItemText, { color: colors.foreground }]}>2FA</Text>
              <Feather name="chevron-right" size={20} color={colors.foreground} />
            </Pressable>
            <View style={styles.newDividerContainer}><View style={[styles.newDivider, { backgroundColor: colors.border }]} /></View>
            <Pressable style={styles.newListItem} onPress={() => router.push("/passkeys")}>
              <View style={styles.newListItemIcon}><Feather name="key" size={20} color={colors.foreground} /></View>
              <Text style={[styles.newListItemText, { color: colors.foreground }]}>Passkey</Text>
              <Feather name="chevron-right" size={20} color={colors.foreground} />
            </Pressable>
            <View style={styles.newDividerContainer}><View style={[styles.newDivider, { backgroundColor: colors.border }]} /></View>
            <Pressable style={styles.newListItem} onPress={() => router.push("/change-password")}>
              <View style={styles.newListItemIcon}><Feather name="lock" size={20} color={colors.foreground} /></View>
              <Text style={[styles.newListItemText, { color: colors.foreground }]}>Change Password</Text>
              <Feather name="chevron-right" size={20} color={colors.foreground} />
            </Pressable>
            <View style={styles.newDividerContainer}><View style={[styles.newDivider, { backgroundColor: colors.border }]} /></View>
            <Pressable style={styles.newListItem} onPress={() => signOut()}>
              <View style={styles.newListItemIcon}><Feather name="log-out" size={20} color={colors.destructive} /></View>
              <Text style={[styles.newListItemText, { color: colors.destructive }]}>Logout</Text>
              <Feather name="chevron-right" size={20} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        <Modal visible={profileModalVisible} animationType="slide" onRequestClose={() => setProfileModalVisible(false)}>
          <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
            <View style={[styles.modalTopBar, { borderBottomColor: colors.border }]}>
              <Pressable onPress={() => setProfileModalVisible(false)} style={styles.closeBtn}>
                <Feather name="chevron-down" size={24} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.modalTitleText, { color: colors.foreground }]}>Account Details</Text>
              <View style={{ width: 32 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <ProfileSection colors={colors} />
            </ScrollView>
          </View>
        </Modal>

      </ScrollView>
    </View>
  );
}


function ProfileSection({ colors }: { colors: any }) {
  const router = useRouter();
  const { user, refreshUser, profilePic, updateProfilePicState } = useAuth();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(user?.firstName ?? (user as any)?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? (user as any)?.last_name ?? "");
  const [saving, setSaving] = useState(false);

  const rawKycStatus = user?.kycStatus ?? (user as any)?.kyc_status ?? "unverified";
  const kycStatus = typeof rawKycStatus === 'string' ? rawKycStatus.toLowerCase() : "unverified";
  const kycApproved = kycStatus === "approved";

  let kycBadgeColor = colors.warning;
  let kycBadgeBg = colors.warning + "20";
  let kycBadgeIcon = "alert-circle";
  let kycBadgeText = "Unverified";

  if (kycStatus === "approved") {
    kycBadgeColor = colors.primary;
    kycBadgeBg = colors.primaryPale;
    kycBadgeIcon = "check-circle";
    kycBadgeText = "Verified";
  } else if (kycStatus === "pending") {
    kycBadgeColor = colors.warning;
    kycBadgeBg = colors.warning + "20";
    kycBadgeIcon = "clock";
    kycBadgeText = "Pending";
  } else if (kycStatus === "rejected") {
    kycBadgeColor = colors.destructive;
    kycBadgeBg = colors.destructive + "20";
    kycBadgeIcon = "x-circle";
    kycBadgeText = "Rejected";
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        country: user?.country,
      });
      await refreshUser();
      toast("Profile updated successfully.", "success");
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const initials = `${(user?.firstName ?? "U")[0] ?? "U"}${(user?.lastName ?? "")[0] ?? ""}`.toUpperCase();
  const [photoLoading, setPhotoLoading] = useState(false);

  const handleChoosePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        toast("Gallery permission is required to upload a profile picture.", "error");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        setPhotoLoading(true);
        const selectedAsset = result.assets[0];
        
        await userApi.uploadProfileImage(selectedAsset.uri);
        
        const base64Uri = "data:image/jpeg;base64," + selectedAsset.base64;
        await updateProfilePicState(base64Uri);
        
        await refreshUser();
        toast("Profile picture updated.", "success");
      }
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoLoading(true);
    try {
      await userApi.removeProfileImage();
      await updateProfilePicState(null);
      await refreshUser();
      toast("Profile picture removed.", "success");
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setPhotoLoading(false);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Profile</Text>
        <View style={[styles.verifiedPill, { backgroundColor: kycBadgeBg }]}>
          <Feather name={kycBadgeIcon as any} size={12} color={kycBadgeColor} />
          <Text style={[styles.verifiedText, { color: kycBadgeColor }]}>
            {kycBadgeText}
          </Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatarBig, { backgroundColor: colors.primaryNeutral, overflow: "hidden" }]}>
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <Text style={[styles.avatarInitials, { color: colors.primaryForeground }]}>{initials}</Text>
            )}
          </View>
          <View style={styles.avatarInfo}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Profile Picture</Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground, marginBottom: 8 }]}>
              {profilePic ? "Personalize your account profile." : "Avatar based on your initials."}
            </Text>
            {photoLoading ? (
              <ActivityIndicator color={colors.primary} size="small" style={{ alignSelf: "flex-start" }} />
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={handleChoosePhoto}
                  style={[styles.photoActionBtn, { backgroundColor: colors.primaryPale, borderColor: colors.primaryNeutral }]}
                >
                  <Text style={[styles.photoActionText, { color: colors.primary }]}>
                    {profilePic ? "Change" : "Upload"}
                  </Text>
                </Pressable>
                {profilePic && (
                  <Pressable
                    onPress={handleRemovePhoto}
                    style={[styles.photoActionBtn, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive }]}
                  >
                    <Text style={[styles.photoActionText, { color: colors.destructive }]}>Remove</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Identity Verification (KYC)</Text>
          <View style={[styles.verifiedPill, { backgroundColor: kycBadgeBg }]}>
            <Feather name={kycBadgeIcon as any} size={10} color={kycBadgeColor} />
            <Text style={[styles.verifiedText, { color: kycBadgeColor, fontSize: 10, textTransform: "capitalize" }]}>{kycBadgeText}</Text>
          </View>
        </View>
        <Text style={[styles.cardSub, { color: colors.mutedForeground, marginBottom: 16 }]}>
          {kycStatus === "approved" 
             ? "Your identity is verified. You have full access to high-limit transactions, premium referral bonuses, and full node operations."
             : kycStatus === "pending"
             ? "Your KYC application is currently under review. We will notify you once it is processed."
             : kycStatus === "rejected"
             ? "Your KYC application was rejected. Please review your details and submit again."
             : "Complete your KYC verification to unlock high-limit transactions, premium referral bonuses, and full node operations."}
        </Text>
        {(kycStatus === "unverified" || kycStatus === "rejected") && (
          <Pressable
            onPress={() => router.push("/kyc")}
            style={[styles.saveBtn, { backgroundColor: kycStatus === "rejected" ? colors.destructive : colors.primary, marginTop: 0 }]}
          >
            <Text style={[styles.saveBtnText, { color: kycStatus === "rejected" ? colors.destructiveForeground : colors.primaryForeground }]}>
              {kycStatus === "rejected" ? "Re-Submit KYC" : "Start KYC Verification"}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Personal Information</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardSub, { color: colors.mutedForeground, marginBottom: 16 }]}>Update your personal details.</Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Username</Text>
          <TextInput
            style={[styles.input, { color: colors.mutedForeground, backgroundColor: colors.background, borderColor: colors.border }]}
            value={user?.username ?? "—"}
            editable={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Email Address</Text>
          <TextInput
            style={[styles.input, { color: colors.mutedForeground, backgroundColor: colors.background, borderColor: colors.border }]}
            value={user?.email ?? "—"}
            editable={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>First Name</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Last Name</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
          {saving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save Changes</Text>}
        </Pressable>
      </View>
    </View>
  );
}





const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  newHeader: { alignItems: "center", marginBottom: 40 },
  newAvatarContainer: { position: "relative", width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  newAvatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#a3c2a4", alignItems: "center", justifyContent: "center" },
  newAvatarInitials: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff" },
  newEditIconContainer: { position: "absolute", right: 0, top: 4, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  newHeaderInfo: { marginTop: 12, alignItems: "center" },
  newHeaderName: { fontFamily: "Inter_600SemiBold", fontSize: 24 },
  newHeaderHandle: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 4 },
  newListContainer: { width: "100%", maxWidth: 400, alignSelf: "center" },
  newSectionTitle: { fontFamily: "Inter_500Medium", fontSize: 20, marginBottom: 20 },
  newCard: { backgroundColor: "transparent", borderWidth: 0, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  newListItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 4 },
  newListItemIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center", marginRight: 16 },
  newListItemText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 16 },
  newDividerContainer: { flexDirection: "row" },
  newDivider: { flex: 1, height: 1, marginLeft: 36 },
  modalTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitleText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 24 },
  tabButton: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  card: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  cardSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  verifiedPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  verifiedText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  avatarRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  avatarBig: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 24, fontFamily: "Inter_700Bold" },
  avatarInfo: { flex: 1 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 14, fontFamily: "Inter_500Medium", justifyContent: "center" },
  saveBtn: { height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginTop: 10 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  outlineBtnLarge: { height: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  outlineBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  sessionItem: { flexDirection: "row", gap: 12, alignItems: "center" },
  sessionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sessionInfo: { flex: 1, gap: 2 },
  sessionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sessionRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  sessionSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sessionTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  currentLabel: { fontSize: 11, fontFamily: "Inter_700Bold" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalOverlayFull: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  countryPanel: { height: "80%", borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0, padding: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16, backgroundColor: "#ccc" },
  outlineBtn: { height: 44, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  closeBtn: { padding: 4 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, height: 52, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  countryList: { flex: 1 },
  countryItem: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 16, borderBottomWidth: 1 },
  countryFlag: { fontSize: 24 },
  countryName: { flex: 1, fontSize: 16, fontFamily: "Inter_500Medium" },
  photoActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  photoActionText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
