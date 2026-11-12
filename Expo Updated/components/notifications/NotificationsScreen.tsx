import React, { useEffect } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useToast } from '@/components/toast/ToastProvider';
import { PrimaryButton } from '@/components/kyc/parts';
import { useNotifications, type NotificationItem } from './store';

type IconName = React.ComponentProps<typeof Feather>['name'];
const ICONS: Record<NotificationItem['kind'], IconName> = { info: 'info', security: 'shield', updates: 'refresh-cw' };
const KIND: Record<NotificationItem['kind'], string> = { info: 'Info', security: 'Security', updates: 'Updates' };

function stamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Time unknown';
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

export function NotificationsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { notifications, unreadCount, markRead, markAllRead, error } = useNotifications();
  const reportError = (cause: unknown) => showToast({ kind: 'error', title: 'Notifications', body: cause instanceof Error ? cause.message : String(cause) });
  useEffect(() => { if (error) showToast({ kind: 'error', title: 'Notifications', body: error }); }, [error, showToast]);

  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  const readAll = async () => {
    try {
      const n = await markAllRead();
      showToast({ kind: 'success', title: 'All caught up', body: n === 1 ? '1 notification marked as read.' : `${n} notifications marked as read.` });
    } catch (cause) { reportError(cause); }
  };

  const top = (Platform.OS === 'web' ? 67 : insets.top) + 8;
  const bottom = Math.max(20, insets.bottom, Platform.OS === 'web' ? 34 : 0);
  const empty = notifications.length === 0;
  const body = { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, color: c.walletSubtle } as const;

  return (
    <View testID="notifications-screen" style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: top, paddingHorizontal: 12 }}>
        <Pressable testID="notifications-back" onPress={back} accessibilityRole="button" accessibilityLabel="Back"
          style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Feather name="arrow-left" size={24} color={c.walletInk} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, flexGrow: 1, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={{ color: c.walletInk, fontFamily: 'DMSans_700Bold', fontSize: 30, letterSpacing: -0.8 }}>Notifications</Text>
        <Text style={[body, { marginTop: 10 }]}>Sample notifications for this app.</Text>

        {empty ? (
          <View testID="notifications-empty" style={{ marginTop: 48, alignItems: 'center', paddingHorizontal: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.walletField, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="bell" size={26} color={c.walletMuted} />
            </View>
            <Text style={{ color: c.walletInk, fontFamily: 'DMSans_600SemiBold', fontSize: 18, marginTop: 18 }}>No notifications</Text>
            <Text style={[body, { textAlign: 'center', marginTop: 6 }]}>There is nothing to show here right now.</Text>
          </View>
        ) : (
          <View style={{ marginTop: 28 }}>
            <Text testID="notifications-unread-count" style={{ color: c.walletInk, fontFamily: 'DMSans_600SemiBold', fontSize: 19, letterSpacing: -0.3, marginBottom: 6 }}>
              {unreadCount === 0 ? 'All read' : unreadCount === 1 ? '1 unread' : `${unreadCount} unread`}
            </Text>
            {notifications.map((n, i) => (
              <Pressable key={n.id} testID={`notifications-item-${n.id}`}
                onPress={() => { if (!n.read) void markRead(n.id).catch(reportError); }}
                accessibilityRole="button"
                accessibilityState={{ selected: !n.read }}
                accessibilityLabel={`${n.read ? 'Read' : 'Unread'} ${KIND[n.kind]} notification: ${n.title}. ${n.body}. ${stamp(n.createdAt)}`}
                accessibilityHint={n.read ? undefined : 'Marks this notification as read'}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14 }, pressed && { backgroundColor: c.walletField, transform: [{ scale: 0.99 }] }]}>
                <View style={{ width: 40, paddingTop: 16 }}>
                  <Feather name={ICONS[n.kind]} size={22} color={n.read ? c.walletMuted : c.walletInk} />
                </View>
                <View style={{ flex: 1, flexDirection: 'row', gap: 12, borderBottomWidth: i === notifications.length - 1 ? 0 : 1, borderBottomColor: c.walletField, paddingVertical: 14 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: c.walletInk, fontFamily: n.read ? 'DMSans_500Medium' : 'DMSans_600SemiBold', fontSize: 17 }}>{n.title}</Text>
                    <Text style={{ color: n.read ? c.walletMuted : c.walletSubtle, fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20, marginTop: 4 }}>{n.body}</Text>
                    <Text style={{ color: c.walletMuted, fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 6 }}>
                      {KIND[n.kind]} · {stamp(n.createdAt)}{n.read ? ' · Read' : ''}
                    </Text>
                  </View>
                  <View style={{ width: 10, paddingTop: 7 }}>
                    {!n.read && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.walletInk }} />}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {!empty && (
        <View style={{ paddingHorizontal: 24, paddingBottom: bottom, paddingTop: 8, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <PrimaryButton testID="notifications-mark-all" label="Mark as Read" disabled={unreadCount === 0} onPress={readAll} />
        </View>
      )}
    </View>
  );
}
