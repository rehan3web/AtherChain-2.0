import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
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
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

import Header from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { useToast } from "@/contexts/ToastContext";
import api, { supportApi, userApi, extractError, getToken } from "@/services/api";
import { io, Socket } from "socket.io-client";
import Skeleton from "@/components/Skeleton";

interface BackendTicket {
  id: number;
  title: string;
  message: string;
  status: "PENDING" | "OPEN" | "RESOLVED" | "REJECTED";
  created_at: string;
  updated_at: string;
  image_url?: string;
}

interface BackendMessage {
  id: number;
  ticket_id: number;
  sender_id: string | null;
  is_admin: boolean;
  message: string;
  image_url?: string;
  created_at: string;
}

type DisplayStatus = "Open" | "Resolved" | "Rejected";

function mapStatus(s: string): DisplayStatus {
  if (s === "RESOLVED") return "Resolved";
  if (s === "REJECTED") return "Rejected";
  return "Open";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function TicketCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.ticketGridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.gridCardHeader}>
        <Skeleton width={80} height={16} borderRadius={4} />
        <Skeleton width={60} height={18} borderRadius={10} />
      </View>
      <Skeleton width={180} height={20} borderRadius={4} style={{ marginVertical: 6 }} />
      <Skeleton width={210} height={14} borderRadius={4} style={{ marginBottom: 6 }} />
      <View style={styles.gridCardFooter}>
        <Skeleton width={100} height={12} borderRadius={4} />
        <Skeleton width={60} height={16} borderRadius={4} />
      </View>
    </View>
  );
}

function ConversationSkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: 16, paddingVertical: 10 }}>
      {/* Original request skeleton card */}
      <View style={[styles.originalDescCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Skeleton width={120} height={14} borderRadius={4} style={{ marginBottom: 8 }} />
        <Skeleton width="100%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
        <Skeleton width="80%" height={14} borderRadius={4} style={{ marginBottom: 12 }} />
        <Skeleton width={150} height={10} borderRadius={3} />
      </View>

      <Text style={[styles.threadTitle, { color: colors.mutedForeground, marginBottom: 4 }]}>Activity & Messages</Text>

      {/* Message bubble left */}
      <View style={[styles.chatBubbleContainer, styles.bubbleLeft]}>
        <View style={[styles.chatBubble, { backgroundColor: colors.card, borderColor: colors.border, width: "70%" }]}>
          <View style={styles.bubbleHeader}>
            <Skeleton width={80} height={12} borderRadius={3} />
            <Skeleton width={60} height={10} borderRadius={3} />
          </View>
          <Skeleton width="100%" height={14} borderRadius={4} style={{ marginVertical: 4 }} />
          <Skeleton width="60%" height={14} borderRadius={4} />
        </View>
      </View>

      {/* Message bubble right */}
      <View style={[styles.chatBubbleContainer, styles.bubbleRight]}>
        <View style={[styles.chatBubble, { backgroundColor: colors.primaryPale, borderColor: colors.primary + "30", width: "65%" }]}>
          <View style={styles.bubbleHeader}>
            <Skeleton width={60} height={12} borderRadius={3} />
            <Skeleton width={60} height={10} borderRadius={3} />
          </View>
          <Skeleton width="100%" height={14} borderRadius={4} style={{ marginVertical: 4 }} />
          <Skeleton width="40%" height={14} borderRadius={4} />
        </View>
      </View>

      {/* Message bubble left */}
      <View style={[styles.chatBubbleContainer, styles.bubbleLeft]}>
        <View style={[styles.chatBubble, { backgroundColor: colors.card, borderColor: colors.border, width: "75%" }]}>
          <View style={styles.bubbleHeader}>
            <Skeleton width={80} height={12} borderRadius={3} />
            <Skeleton width={60} height={10} borderRadius={3} />
          </View>
          <Skeleton width="100%" height={14} borderRadius={4} style={{ marginVertical: 4 }} />
          <Skeleton width="80%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
          <Skeleton width="50%" height={14} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

export default function HelpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<BackendTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedTicket, setSelectedTicket] = useState<BackendTicket | null>(null);
  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [ticketImage, setTicketImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);

  const [activeFilter, setActiveFilter] = useState<"All" | DisplayStatus>("All");

  // Register Expo push token so backend can send push notifications on admin reply
  useEffect(() => {
    (async () => {
      if (Platform.OS === "web" || !Device.isDevice) return;
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync({
          projectId: projectId || "8a5d8327-e345-4274-a180-f47a5d183369",
        });
        if (token) await userApi.registerPushToken(token).catch(() => { });
      } catch { }
    })();
  }, []);

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await supportApi.list();
      setTickets(res.tickets || []);
    } catch (e: any) {
      if (!silent) toast(extractError(e), "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    if (!selectedTicket?.id) return;

    let socket: Socket | null = null;
    const ticketId = String(selectedTicket.id);

    const initSocket = async () => {
      try {
        const token = await getToken();
        const baseUrl = api.defaults.baseURL || "https://api.atherchain.com";

        socket = io(baseUrl, {
          auth: { token },
          transports: ["websocket", "polling"],
        });

        socket.on("connect", () => {
          socket?.emit("join_ticket", ticketId);
        });

        socket.on("new_message", async (message: BackendMessage) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === message.id);
            if (exists) return prev;
            return [...prev, message];
          });

          // Refresh details & list dynamically
          try {
            const detail = await supportApi.getDetails(ticketId);
            setSelectedTicket(detail.ticket);
          } catch { }
          loadTickets(true);
        });
      } catch (err) {
        console.error("Socket error in help.tsx:", err);
      }
    };

    initSocket();

    return () => {
      if (socket) {
        socket.emit("leave_ticket", ticketId);
        socket.disconnect();
      }
    };
  }, [selectedTicket?.id, loadTickets]);

  const handleOpenTicket = async (ticket: BackendTicket) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTicket(ticket);
    setMessages([]);
    setDetailLoading(true);
    try {
      const detail = await supportApi.getDetails(String(ticket.id));
      setMessages(detail.messages || []);
      setSelectedTicket(detail.ticket);
    } catch (e: any) {
      toast(extractError(e), "error");
    } finally {
      setDetailLoading(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: false }), 200);
    }
  };

  const handleSelectImage = async (source: "library" | "camera") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      let result;
      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") { alert("Camera permission is required."); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") { alert("Library permission is required."); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      }
      if (!result.canceled && result.assets?.[0]?.uri) {
        setTicketImage(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) { console.log(e); }
  };

  const handleSubmitTicket = async () => {
    if (!subject.trim() || !description.trim()) return;
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await supportApi.create(subject.trim(), description.trim(), ticketImage || undefined);
      await loadTickets(true);
      setSubject("");
      setDescription("");
      setTicketImage(null);
      setShowCreateModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast("Ticket submitted! Our team will review it shortly.", "success");
    } catch (e: any) {
      toast(extractError(e), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket || isSendingReply) return;
    const msgText = replyText.trim();
    setReplyText("");
    setIsSendingReply(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await supportApi.reply(String(selectedTicket.id), msgText);
      const detail = await supportApi.getDetails(String(selectedTicket.id));
      setMessages(detail.messages || []);
      setSelectedTicket(detail.ticket);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (e: any) {
      toast(extractError(e), "error");
      setReplyText(msgText);
    } finally {
      setIsSendingReply(false);
    }
  };

  const getStatusColor = (status: DisplayStatus) => {
    if (status === "Open") return colors.primary;
    if (status === "Resolved") return "#4287f5";
    return colors.destructive;
  };

  const getStatusBgColor = (status: DisplayStatus) => {
    if (status === "Open") return colors.primaryPale;
    if (status === "Resolved") return "#4287f520";
    return colors.destructive + "20";
  };

  const filteredTickets = tickets.filter((t) => {
    if (activeFilter === "All") return true;
    return mapStatus(t.status) === activeFilter;
  });

  const totalCount = tickets.length;
  const openCount = tickets.filter((t) => t.status === "PENDING" || t.status === "OPEN").length;
  const resolvedCount = tickets.filter((t) => t.status === "RESOLVED").length;
  const rejectedCount = tickets.filter((t) => t.status === "REJECTED").length;

  const canReply = selectedTicket && (selectedTicket.status === "PENDING" || selectedTicket.status === "OPEN");
  const isPurged = selectedTicket && (selectedTicket.status === "RESOLVED" || selectedTicket.status === "REJECTED");

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

        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground, flex: 1 }]}>Help & Support</Text>
          <Pressable
            onPress={() => { setShowCreateModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={[styles.createHeaderBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={[styles.createHeaderBtnText, { color: colors.primaryForeground }]}>Create Ticket</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: "Total", count: totalCount, color: colors.foreground },
            { label: "Open", count: openCount, color: colors.primary },
            { label: "Resolved", count: resolvedCount, color: "#4287f5" },
            { label: "Rejected", count: rejectedCount, color: colors.destructive },
          ].map(({ label, count, color }) => (
            <View key={label} style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statsNum, { color }]}>{count}</Text>
              <Text style={[styles.statsLabel, { color: colors.mutedForeground }]}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Support Tickets</Text>
        </View>

        {/* Filters */}
        <View style={styles.filterChipsRow}>
          {(["All", "Open", "Resolved", "Rejected"] as const).map((filter) => {
            const isSelected = activeFilter === filter;
            return (
              <Pressable
                key={filter}
                onPress={() => { setActiveFilter(filter); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={[styles.filterChip, { backgroundColor: isSelected ? colors.primary : colors.card, borderColor: isSelected ? colors.primary : colors.border }]}
              >
                <Text style={[styles.filterChipText, { color: isSelected ? colors.primaryForeground : colors.mutedForeground, fontFamily: isSelected ? "Inter_700Bold" : "Inter_500Medium" }]}>
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Ticket list */}
        {loading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalGrid}
          >
            {[1, 2, 3].map((key) => <TicketCardSkeleton key={key} />)}
          </ScrollView>
        ) : filteredTickets.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalGrid}
            snapToInterval={280}
            decelerationRate="fast"
          >
            {filteredTickets.map((ticket) => {
              const displayStatus = mapStatus(ticket.status);
              return (
                <Pressable
                  key={ticket.id}
                  onPress={() => handleOpenTicket(ticket)}
                  style={[styles.ticketGridCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.gridCardHeader}>
                    <Text style={[styles.ticketCode, { color: colors.mutedForeground }]} numberOfLines={1}>#ATH-{String(ticket.id).slice(0, 8)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(displayStatus) }]}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(displayStatus) }]} />
                      <Text style={[styles.statusText, { color: getStatusColor(displayStatus) }]}>{displayStatus}</Text>
                    </View>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                    <Text style={[styles.ticketSubject, { color: colors.foreground, marginBottom: 0, paddingRight: 24 }]}>
                      {ticket.title}
                    </Text>
                  </ScrollView>

                  <Text style={[styles.ticketDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {ticket.message === "PURGED" ? "This conversation has been archived." : ticket.message}
                  </Text>

                  <View style={styles.gridCardDivider} />

                  <View style={styles.gridCardFooter}>
                    <Text style={[styles.ticketDate, { color: colors.mutedForeground }]}>{formatDate(ticket.created_at)}</Text>
                    <View style={styles.rowAlign}>
                      <Text style={[styles.viewDetailsText, { color: colors.primary }]}>Details</Text>
                      <Feather name="chevron-right" size={14} color={colors.primary} />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="folder-minus" size={32} color={colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>
              No {activeFilter !== "All" ? activeFilter.toLowerCase() + " " : ""}tickets found.
            </Text>
          </View>
        )}

        {/* Instructions */}
        <View style={[styles.instructionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={20} color={colors.primary} style={{ marginBottom: 8 }} />
          <Text style={[styles.instructionsTitle, { color: colors.foreground }]}>Need technical support?</Text>
          <Text style={[styles.instructionsBody, { color: colors.mutedForeground }]}>
            Tap "Create Ticket" to request help. Open a ticket card to continue the conversation. You'll receive a push notification when our team replies.
          </Text>
        </View>
      </ScrollView>

      {/* CREATE TICKET MODAL */}
      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlayFull}>
          <View style={[styles.createPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={[styles.modalTitle, { color: colors.foreground, paddingRight: 24 }]}>Create Support Ticket</Text>
                </ScrollView>
                <Text style={[styles.modalCode, { color: colors.mutedForeground }]}>Submit new request</Text>
              </View>
              <Pressable onPress={() => setShowCreateModal(false)} style={styles.closeBtn}>
                <Feather name="x" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.createModalScrollContent} keyboardShouldPersistTaps="handled">
              <Text style={[styles.formSub, { color: colors.mutedForeground }]}>
                Got issues with node sync, swap transactions, or referrals? File a ticket below.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Subject</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="e.g. Node rewards sync error"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Description</Text>
                <TextInput
                  style={[styles.textArea, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Provide complete details about your issue..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Attachment (Optional)</Text>
                {ticketImage ? (
                  <View style={styles.previewCard}>
                    <Image source={{ uri: ticketImage }} style={styles.previewImage} />
                    <Pressable onPress={() => setTicketImage(null)} style={[styles.removeImageBtn, { backgroundColor: colors.destructive }]}>
                      <Feather name="x" size={14} color={colors.destructiveForeground} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.uploadRow}>
                    <Pressable onPress={() => handleSelectImage("library")} style={[styles.uploadBtn, { borderColor: colors.border }]}>
                      <Feather name="image" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.uploadBtnText, { color: colors.mutedForeground }]}>Upload Image</Text>
                    </Pressable>
                    <Pressable onPress={() => handleSelectImage("camera")} style={[styles.uploadBtn, { borderColor: colors.border }]}>
                      <Feather name="camera" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.uploadBtnText, { color: colors.mutedForeground }]}>Take Photo</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <Pressable
                onPress={handleSubmitTicket}
                disabled={!subject.trim() || !description.trim() || isSubmitting}
                style={[styles.submitBtn, { backgroundColor: subject.trim() && description.trim() && !isSubmitting ? colors.primary : colors.border }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.submitBtnText, { color: subject.trim() && description.trim() ? colors.primaryForeground : colors.mutedForeground }]}>
                    Submit Ticket
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* TICKET DETAILS MODAL */}
      <Modal visible={selectedTicket !== null} animationType="slide" transparent onRequestClose={() => setSelectedTicket(null)}>
        {selectedTicket && (
          <View style={styles.modalOverlayFull}>
            <View style={[styles.detailsPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Text style={[styles.modalTitle, { color: colors.foreground, paddingRight: 24 }]}>{selectedTicket.title}</Text>
                  </ScrollView>
                  <Text style={[styles.modalCode, { color: colors.mutedForeground }]} numberOfLines={1}>ID: #ATH-{String(selectedTicket.id).slice(0, 8)}</Text>
                </View>
                <Pressable onPress={() => setSelectedTicket(null)} style={styles.closeBtn}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </Pressable>
              </View>

              {detailLoading ? (
                <ScrollView showsVerticalScrollIndicator={false} style={styles.chatScrollView}>
                  <ConversationSkeleton />
                </ScrollView>
              ) : (
                <ScrollView
                  ref={chatScrollRef}
                  showsVerticalScrollIndicator={false}
                  style={styles.chatScrollView}
                  contentContainerStyle={{ paddingBottom: 16 }}
                >
                  {/* Original request */}
                  <View style={[styles.originalDescCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.origTitle, { color: colors.foreground }]}>Original Request</Text>
                    <Text style={[styles.origText, { color: colors.foreground }]}>
                      {selectedTicket.message === "PURGED" ? "Message content archived after ticket closed." : selectedTicket.message}
                    </Text>
                    <Text style={[styles.origDate, { color: colors.mutedForeground }]}>Submitted {formatDate(selectedTicket.created_at)}</Text>
                  </View>

                  {/* Messages thread */}
                  {messages.length > 0 && (
                    <View style={styles.threadSection}>
                      <Text style={[styles.threadTitle, { color: colors.mutedForeground }]}>Activity & Messages</Text>
                      {messages.map((msg, index) => {
                        const isUser = !msg.is_admin;
                        const isPurgedMsg = msg.message === "PURGED";
                        return (
                          <View
                            key={msg.id ?? index}
                            style={[styles.chatBubbleContainer, isUser ? styles.bubbleRight : styles.bubbleLeft]}
                          >
                            <View
                              style={[
                                styles.chatBubble,
                                isUser
                                  ? { backgroundColor: colors.primaryPale, borderColor: colors.primary + "30" }
                                  : { backgroundColor: colors.card, borderColor: colors.border },
                              ]}
                            >
                              <View style={styles.bubbleHeader}>
                                <Text style={[styles.bubbleSenderName, { color: isUser ? colors.primary : "#4287f5", fontFamily: "Inter_700Bold" }]}>
                                  {isUser ? "You" : "Support Agent"}
                                </Text>
                                <Text style={[styles.bubbleTime, { color: colors.mutedForeground }]}>
                                  {formatDate(msg.created_at)}
                                </Text>
                              </View>
                              <Text style={[styles.bubbleMessage, { color: isPurgedMsg ? colors.mutedForeground : colors.foreground, fontStyle: isPurgedMsg ? "italic" : "normal" }]}>
                                {isPurgedMsg ? "Message archived." : msg.message}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {isPurged && (
                    <View style={[styles.archivedBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <Feather name="archive" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.archivedText, { color: colors.mutedForeground }]}>
                        This ticket has been closed. Conversation archived.
                      </Text>
                    </View>
                  )}
                </ScrollView>
              )}

              {/* Reply input (only for open/pending) */}
              {canReply && !detailLoading && (
                <View style={[styles.chatInputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <TextInput
                    style={[styles.chatTextInput, { color: colors.foreground }]}
                    placeholder="Type a message to reply..."
                    placeholderTextColor={colors.mutedForeground}
                    value={replyText}
                    onChangeText={setReplyText}
                    onSubmitEditing={handleSendReply}
                    editable={!isSendingReply}
                  />
                  <Pressable
                    onPress={handleSendReply}
                    disabled={!replyText.trim() || isSendingReply}
                    style={[styles.sendBtn, { backgroundColor: replyText.trim() && !isSendingReply ? colors.primary : colors.border }]}
                  >
                    {isSendingReply ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Feather name="send" size={16} color={replyText.trim() ? colors.primaryForeground : colors.mutedForeground} />
                    )}
                  </Pressable>
                </View>
              )}

              <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                <View style={styles.rowAlign}>
                  <Text style={[styles.modalFooterLabel, { color: colors.mutedForeground }]}>Status:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(mapStatus(selectedTicket.status)) }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(mapStatus(selectedTicket.status)) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(mapStatus(selectedTicket.status)) }]}>{mapStatus(selectedTicket.status)}</Text>
                  </View>
                </View>
                {canReply ? (
                  <Text style={[styles.openAlertText, { color: colors.primary }]}>Conversation open. You can reply.</Text>
                ) : (
                  <Text style={[styles.openAlertText, { color: colors.mutedForeground }]}>Ticket is closed.</Text>
                )}
              </View>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  createHeaderBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18 },
  createHeaderBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  rowAlign: { flexDirection: "row", alignItems: "center", gap: 6 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  statsCard: { flex: 1, paddingVertical: 16, paddingHorizontal: 8, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  statsNum: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 2 },
  statsLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },

  sectionHeader: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },

  filterChipsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13 },

  horizontalGrid: { gap: 12, paddingBottom: 8 },
  ticketGridCard: { width: 270, borderRadius: 24, borderWidth: 1, padding: 18, justifyContent: "space-between", minHeight: 165 },
  gridCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 },
  ticketCode: { fontSize: 12, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },

  ticketSubject: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 6 },
  ticketDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 12 },

  gridCardDivider: { height: 1, backgroundColor: "transparent", marginVertical: 4 },
  gridCardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.04)", paddingTop: 10 },
  ticketDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  viewDetailsText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  emptyCard: { padding: 32, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyCardText: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },

  instructionsCard: { padding: 20, borderRadius: 24, borderWidth: 1, marginTop: 24 },
  instructionsTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 6 },
  instructionsBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  modalOverlayFull: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  createPanel: { height: "85%", borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0, padding: 24 },
  detailsPanel: { height: "85%", borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0, padding: 24 },
  createModalScrollContent: { paddingBottom: 40 },

  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalCode: { fontSize: 12, fontFamily: "Inter_500Medium" },
  closeBtn: { padding: 4 },

  formSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  input: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontSize: 14, fontFamily: "Inter_500Medium" },
  textArea: { height: 100, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_500Medium", textAlignVertical: "top" },

  uploadRow: { flexDirection: "row", gap: 10 },
  uploadBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  uploadBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  previewCard: { position: "relative", width: 120, height: 80, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  removeImageBtn: { position: "absolute", right: 6, top: 6, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  submitBtn: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginTop: 8 },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },

  chatScrollView: { flex: 1, marginVertical: 12 },
  originalDescCard: { padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  origTitle: { fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 8 },
  origText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  origDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 12 },

  threadSection: { gap: 14 },
  threadTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4 },

  chatBubbleContainer: { flexDirection: "row", width: "100%" },
  bubbleLeft: { justifyContent: "flex-start" },
  bubbleRight: { justifyContent: "flex-end" },
  chatBubble: { maxWidth: "85%", borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  bubbleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 16, marginBottom: 6 },
  bubbleSenderName: { fontSize: 12 },
  bubbleTime: { fontSize: 10, fontFamily: "Inter_400Regular" },
  bubbleMessage: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  chatInputRow: { flexDirection: "row", alignItems: "center", padding: 8, borderRadius: 24, borderWidth: 1, gap: 8, marginBottom: 12 },
  chatTextInput: { flex: 1, height: 40, paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_500Medium" },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },

  archivedBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 16 },
  archivedText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },

  modalFooter: { borderTopWidth: 1, paddingTop: 16, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalFooterLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  openAlertText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
