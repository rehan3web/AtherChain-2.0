import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import { ToastSurface, useToast } from '@/components/toast/ToastProvider';
import { TicketUploader } from './TicketUploader';
import { canReply, loadTickets, sendTicketMessage, useTickets, type Attachment, type TicketStatus } from './tickets';

const MAX = 2000;
const fmt = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const READONLY_REASON: Record<string, string> = {
  Resolved: 'This ticket was marked resolved. Replies are closed. Create a new ticket if you need more help.',
  Rejected: 'This ticket was rejected and is read-only. Create a new ticket if the issue continues.',
  Closed: 'This ticket is closed and is read-only. Create a new ticket if you need more help.',
};

function AttachmentList({ files, onOpen, inverse }: { files: Attachment[]; onOpen: (f: Attachment) => void; inverse?: boolean }) {
  const c = useColors();
  if (!files.length) return null;
  return (
    <View style={styles.files}>
      {files.map(f => (
        <Pressable key={f.id} onPress={() => onOpen(f)} accessibilityRole="button" accessibilityLabel={`Open ${f.name}`}
          style={({ pressed }) => [styles.file, { backgroundColor: inverse ? c.walletField : c.walletFieldPressed, opacity: pressed ? .6 : 1, transform: [{ scale: pressed ? .98 : 1 }] }]}>
          <Feather name={f.kind === 'MP4' ? 'film' : 'image'} size={15} color={c.walletInk} />
          <Text numberOfLines={1} style={[styles.fileName, { color: c.walletInk }]}>{f.name}</Text>
          <Text style={[styles.meta, { color: c.walletSubtle }]}>{(f.size / 1e6).toFixed(1)} MB</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function TicketChatScreen() {
  const c = useColors();
  const { scheme } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tickets, loading, error } = useTickets();
  const ticket = tickets.find(t => t.id === id);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const sendingRef = useRef(false);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [retrying, setRetrying] = useState(false);
  const count = ticket?.messages?.length ?? 0;
  useEffect(() => { const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60); return () => clearTimeout(t); }, [count]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/help'));
  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bottom = Math.max(insets.bottom, 12);
  const statusColor = (s: TicketStatus) => s === 'Resolved' ? c.walletPositive : s === 'Rejected' ? c.walletError : s === 'Closed' ? c.walletSubtle : c.primary;

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try { await loadTickets(); } catch { showToast({ kind: 'error', title: 'Still unavailable', body: 'Could not load your tickets. Try again.' }); }
    finally { setRetrying(false); }
  };

  const openFile = async (f: Attachment) => {
    if (!f.uri) { showToast({ kind: 'error', title: 'Preview unavailable', body: 'This attachment has no saved file on this device.' }); return; }
    if (Platform.OS === 'web') { setPreview(f); return; }
    if (f.kind !== 'MP4') { setPreview(f); return; }
    try {
      if (!(await Linking.canOpenURL(f.uri))) throw new Error('unsupported');
      await Linking.openURL(f.uri);
    } catch {
      showToast({ kind: 'error', title: 'Could not open video', body: 'No app on this device can play this file.' });
    }
  };

  const send = async () => {
    if (!ticket || !canReply(ticket.status) || sendingRef.current || uploadBusy) return;
    const text = body.trim();
    if (!text && !files.length) { setSendError('Write a message or add an attachment.'); return; }
    sendingRef.current = true; setSending(true); setSendError('');
    try {
      await sendTicketMessage(ticket.id, text, files);
      setBody(''); setFiles([]); setAttachOpen(false);
    } catch {
      setSendError('Message not sent. Your draft is kept, try again.');
      showToast({ kind: 'error', title: 'Message not sent', body: 'Your draft is still here.' });
    } finally { sendingRef.current = false; setSending(false); }
  };

  const header = (
    <View style={styles.header}>
      <Pressable testID="ticket-chat-back" onPress={back} accessibilityRole="button" accessibilityLabel="Go back"
        style={({ pressed }) => [styles.iconButton, { opacity: pressed ? .5 : 1 }]}>
        <Feather name="arrow-left" size={24} color={c.walletInk} />
      </Pressable>
      {ticket && (
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: c.walletInk }]}>{ticket.subject}</Text>
          <Text style={[styles.meta, { color: c.walletSubtle }]}>{ticket.id}</Text>
        </View>
      )}
      {ticket && (
        <View testID="ticket-chat-status" accessibilityLabel={`Status ${ticket.status}`} style={[styles.badge, { borderColor: c.walletDisabled }]}>
          <View style={[styles.dot, { backgroundColor: statusColor(ticket.status) }]} />
          <Text style={[styles.badgeText, { color: c.walletInk }]}>{ticket.status}</Text>
        </View>
      )}
    </View>
  );

  const state = (icon: React.ComponentProps<typeof Feather>['name'], title: string, sub: string, withRetry?: boolean) => (
    <View style={styles.center}>
      {loading && !error ? (
        <View style={styles.skeletonWrap}>
          {[.7, .5, .85].map((w, i) => <View key={i} style={[styles.skeleton, { width: `${w * 100}%`, alignSelf: i % 2 ? 'flex-end' : 'flex-start', backgroundColor: c.walletField }]} />)}
        </View>
      ) : <Feather name={icon} size={28} color={c.walletSubtle} />}
      <Text style={[styles.stateTitle, { color: c.walletInk }]}>{title}</Text>
      <Text testID={withRetry ? 'ticket-chat-error' : undefined} accessibilityRole={withRetry ? 'alert' : undefined} style={[styles.sub, { color: c.walletSubtle }]}>{sub}</Text>
      {withRetry && (
        <Pressable testID="ticket-chat-retry" onPress={retry} disabled={retrying} accessibilityRole="button"
          style={({ pressed }) => [styles.pill, { backgroundColor: c.walletInk, opacity: retrying ? .5 : pressed ? .7 : 1 }]}>
          <Text style={[styles.pillText, { color: c.walletOnInk }]}>{retrying ? 'Retrying…' : 'Try again'}</Text>
        </Pressable>
      )}
    </View>
  );

  let content: React.ReactNode;
  if (error) content = state('alert-circle', 'Could not load this ticket', error, true);
  else if (loading) content = state('loader', 'Loading conversation', 'Fetching your saved history on this device.');
  else if (!ticket) content = state('help-circle', 'Ticket not found', 'It may have been removed from this device.');
  else {
    const replyable = canReply(ticket.status);
    const empty = !body.trim() && !files.length;
    content = (
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
          contentContainerStyle={styles.thread}>
          <View style={[styles.notice, { backgroundColor: c.walletDemo }]}>
            <Feather name="info" size={14} color={c.walletDemoInk} style={{ marginTop: 2 }} />
            <Text style={[styles.noticeText, { color: c.walletDemoInk }]}>Practice conversation saved only on this device. Support replies are automated samples, not a real person.</Text>
          </View>
          <View style={[styles.original, { borderColor: c.walletDisabled }]}>
            <Text style={[styles.eyebrow, { color: c.walletSubtle }]}>ORIGINAL REQUEST · {ticket.date}</Text>
            <Text style={[styles.body, { color: c.walletInk }]}>{ticket.description}</Text>
            {ticket.attachments.length ? <AttachmentList files={ticket.attachments} onOpen={openFile} inverse /> : <Text style={[styles.meta, { color: c.walletSubtle }]}>No attachments</Text>}
          </View>
          {(ticket.messages ?? []).map(m => {
            const mine = m.author === 'user';
            return (
              <View key={m.id} style={[styles.msgWrap, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
                {!mine && <Text style={[styles.meta, { color: c.walletSubtle }]}>Practice support · sample reply</Text>}
                <View style={[styles.bubble, mine ? { backgroundColor: c.walletInk, borderBottomRightRadius: 6 } : { backgroundColor: c.walletField, borderBottomLeftRadius: 6 }]}>
                  {!!m.body && <Text style={[styles.body, { color: mine ? c.walletOnInk : c.walletInk }]}>{m.body}</Text>}
                  <AttachmentList files={m.attachments} onOpen={openFile} inverse={mine} />
                </View>
                <Text style={[styles.time, { color: c.walletSubtle }]}>{fmt(m.createdAt)}</Text>
              </View>
            );
          })}
        </ScrollView>
        {replyable ? (
          <View style={[styles.composer, { borderTopColor: c.walletDisabled, paddingBottom: bottom, backgroundColor: c.walletCardTop }]}>
            {attachOpen && <View style={styles.attachPanel}><TicketUploader value={files} onChange={setFiles} onBusyChange={setUploadBusy} /></View>}
            {!attachOpen && files.length > 0 && <Text style={[styles.meta, { color: c.walletSubtle }]}>{files.length} attachment{files.length > 1 ? 's' : ''} ready</Text>}
            {!!sendError && <Text accessibilityRole="alert" style={[styles.err, { color: c.walletError }]}>{sendError}</Text>}
            <View style={styles.inputRow}>
              <Pressable testID="ticket-chat-attach" onPress={() => setAttachOpen(o => !o)} disabled={sending} accessibilityRole="button"
                accessibilityLabel={attachOpen ? 'Hide attachments' : 'Add attachments'} accessibilityState={{ expanded: attachOpen }}
                style={({ pressed }) => [styles.round, { backgroundColor: attachOpen ? c.walletFieldPressed : c.walletField, opacity: pressed ? .6 : 1, transform: [{ scale: pressed ? .94 : 1 }] }]}>
                <Feather name={attachOpen ? 'x' : 'paperclip'} size={18} color={c.walletInk} />
              </Pressable>
              <View style={[styles.inputBox, { backgroundColor: c.walletField }]}>
                <TextInput testID="ticket-chat-input" accessibilityLabel="Message" value={body} onChangeText={t => { setBody(t); if (sendError) setSendError(''); }}
                  multiline maxLength={MAX} editable={!sending} placeholder="Write a message…" placeholderTextColor={c.walletSubtle}
                  keyboardAppearance={scheme} style={[styles.input, { color: c.walletInk }]} />
                {body.length > MAX * .8 && <Text style={[styles.counter, { color: c.walletSubtle }]}>{body.length}/{MAX}</Text>}
              </View>
              <Pressable testID="ticket-chat-send" onPress={send} disabled={empty || sending || uploadBusy} accessibilityRole="button" accessibilityLabel="Send message"
                accessibilityState={{ disabled: empty || sending || uploadBusy, busy: sending }}
                style={({ pressed }) => [styles.round, { backgroundColor: empty || uploadBusy ? c.walletDisabled : c.walletInk, opacity: sending ? .5 : pressed ? .7 : 1, transform: [{ scale: pressed ? .94 : 1 }] }]}>
                <Feather name={sending ? 'more-horizontal' : 'arrow-up'} size={18} color={empty || uploadBusy ? c.walletDisabledInk : c.walletOnInk} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View testID="ticket-chat-readonly" accessibilityRole="summary" style={[styles.readonly, { borderTopColor: c.walletDisabled, paddingBottom: bottom + 6 }]}>
            <View style={[styles.lock, { backgroundColor: c.walletField }]}><Feather name="lock" size={16} color={statusColor(ticket.status)} /></View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.stateTitle, { color: c.walletInk, fontSize: 14 }]}>{ticket.status} · read-only</Text>
              <Text style={[styles.sub, { color: c.walletSubtle, marginTop: 0 }]}>{READONLY_REASON[ticket.status] ?? 'This ticket no longer accepts replies.'}</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View testID="ticket-chat-screen" style={[styles.page, { backgroundColor: c.walletCardTop, paddingTop: top }]}>
      {header}
      {content}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        {preview && <ToastSurface>
          <Pressable onPress={() => setPreview(null)} accessibilityRole="button" accessibilityLabel="Close preview" style={[styles.scrim, { backgroundColor: c.walletScrim }]}>
            {preview.kind === 'MP4' && Platform.OS === 'web'
              ? React.createElement('video', { src: preview.uri, controls: true, autoPlay: false,
                onClick: (event: React.MouseEvent) => event.stopPropagation(),
                style: { width: '100%', maxHeight: '80%' },
                onError: () => { setPreview(null); showToast({ kind: 'error', title: 'Could not open video', body: 'The saved video is unavailable or unsupported.' }); } })
              : <Image source={{ uri: preview.uri }} resizeMode="contain" style={styles.previewImg} accessibilityLabel={preview.name}
              onError={() => { setPreview(null); showToast({ kind: 'error', title: 'Could not open image', body: 'The file is no longer available on this device.' }); }} />
            }
            <Text style={[styles.pillText, { color: c.walletOnInk }]}>{preview.name} · Tap to close</Text>
          </Pressable>
        </ToastSurface>}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { minHeight: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 15, fontFamily: 'DMSans_600SemiBold', letterSpacing: -.3 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 10, fontFamily: 'DMSans_500Medium' },
  thread: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 14 },
  notice: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14 },
  noticeText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18 },
  original: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 16, gap: 10 },
  eyebrow: { fontSize: 10, letterSpacing: 1.5, fontFamily: 'DMSans_500Medium' },
  body: { fontSize: 14, lineHeight: 22, fontFamily: 'DMSans_400Regular' },
  meta: { fontSize: 11, fontFamily: 'DMSans_400Regular' },
  time: { fontSize: 10, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  msgWrap: { gap: 4 },
  bubble: { maxWidth: '86%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11, gap: 8 },
  files: { gap: 6 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, minHeight: 40, borderRadius: 12 },
  fileName: { flex: 1, fontSize: 12, fontFamily: 'DMSans_500Medium' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10, gap: 8, width: '100%', maxWidth: 640, alignSelf: 'center' },
  attachPanel: { maxHeight: 300 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  inputBox: { flex: 1, borderRadius: 22, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  input: { fontFamily: 'DMSans_400Regular', fontSize: 14, maxHeight: 120, paddingVertical: 11 },
  counter: { fontSize: 10, fontFamily: 'DMSans_400Regular', alignSelf: 'flex-end', paddingBottom: 6 },
  err: { fontSize: 12, fontFamily: 'DMSans_400Regular' },
  readonly: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  lock: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  skeletonWrap: { width: '100%', maxWidth: 360, gap: 10, marginBottom: 12 },
  skeleton: { height: 44, borderRadius: 18 },
  stateTitle: { fontSize: 17, fontFamily: 'DMSans_600SemiBold', letterSpacing: -.4, textAlign: 'center' },
  sub: { fontSize: 13, lineHeight: 20, fontFamily: 'DMSans_400Regular', textAlign: 'center' },
  pill: { minHeight: 48, borderRadius: 24, paddingHorizontal: 22, justifyContent: 'center', marginTop: 8 },
  pillText: { fontSize: 14, fontFamily: 'DMSans_500Medium' },
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 },
  previewImg: { width: '100%', height: '80%', borderRadius: 16 },
});
