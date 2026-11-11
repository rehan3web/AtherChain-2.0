import React, { useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { TicketUploader } from './TicketUploader';
import { TicketFilter, type TicketFilterValue } from './TicketFilter';
import { ToastSurface, useToast } from '@/components/toast/ToastProvider';
import { createTicket, loadTickets, useTickets, type Attachment, type TicketStatus } from './tickets';

export function HelpScreen() {
  const c = useColors();
  const { showToast } = useToast();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tickets, loading, error: loadError } = useTickets();
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [filter, setFilter] = useState<TicketFilterValue>('All');
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const statusColor = (status: TicketStatus) => status === 'Resolved' ? c.walletPositive : status === 'Rejected' ? c.walletError : status === 'Closed' ? c.walletSubtle : c.primary;
  const closeForm = () => {
    setCreating(false); setSubject(''); setDescription(''); setAttachments([]); setError(''); setDiscard(false); setUploadBusy(false);
  };
  const back = () => {
    if (submitting.current) return;
    if (creating) {
      if (subject.trim() || description.trim() || attachments.length || uploadBusy) { setDiscard(true); return; }
      closeForm(); return;
    }
    router.canGoBack() ? router.back() : router.replace('/');
  };
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try { await loadTickets(); } catch { showToast({ kind: 'error', title: 'Still unavailable', body: 'Could not load your tickets.' }); } finally { setRetrying(false); }
  };
  const blocked = loading || !!loadError;
  const submit = async () => {
    if (uploadBusy || submitting.current || blocked) return;
    if (!subject.trim() || !description.trim()) {
      const message = 'Please enter a subject and description.';
      setError(message);
      showToast({ kind: 'error', title: 'Complete your ticket', body: 'Fill both required fields.' });
      return;
    }
    submitting.current = true; setSaving(true); setError('');
    try {
      const ticket = await createTicket(subject.trim(), description.trim(), attachments);
      setFilter('All');
      showToast({ kind: 'success', title: 'Ticket created', body: `${ticket.id} is now open.` });
      closeForm();
      router.push({ pathname: '/ticket/[id]', params: { id: ticket.id } });
    } catch {
      setError('Could not save your ticket. Your draft is kept, please try again.');
      showToast({ kind: 'error', title: 'Ticket not saved', body: 'Your draft is still here.' });
    } finally { submitting.current = false; setSaving(false); }
  };
  const visible = filter === 'All' ? tickets : tickets.filter(ticket => ticket.status === filter);
  const bottom = Math.max(insets.bottom, 24);
  const label = (text: string) => <Text style={[styles.label, { color: c.walletInk }]}>{text}</Text>;
  const badge = (status: TicketStatus) => (
    <View style={[styles.badge, { borderColor: c.walletDisabled }]}>
      <View style={[styles.dot, { backgroundColor: statusColor(status) }]} />
      <Text style={[styles.badgeText, { color: c.walletInk }]}>{status}</Text>
    </View>
  );
  return (
    <View testID="screen-help" style={[styles.page, { backgroundColor: c.walletCardTop, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="help-back" onPress={back} accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconButton}><Feather name="arrow-left" size={24} color={c.walletInk} /></Pressable>
      </View>
      {creating ? (
        <KeyboardAwareScrollViewCompat keyboardShouldPersistTaps="handled" bottomOffset={70} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottom }]}>
          <Text style={[styles.eyebrow, { color: c.walletSubtle }]}>LET’S SORT IT OUT</Text>
          <Text style={[styles.title, { color: c.walletInk }]}>How can we help?</Text>
          <Text style={[styles.subtitle, { color: c.walletSubtle }]}>A little detail makes all the difference.</Text>
          <View style={styles.form}>
            <View style={styles.field}>
              {label('Subject')}
              <TextInput testID="help-subject" editable={!saving} accessibilityLabel="Subject" value={subject} onChangeText={setSubject} maxLength={100} placeholder="What do you need help with?" placeholderTextColor={c.walletSubtle} keyboardAppearance={scheme} style={[styles.input, { color: c.walletInk, backgroundColor: c.walletField }]} returnKeyType="next" />
            </View>
            <View style={styles.field}>
              <View style={styles.between}>{label('Description')}<Text style={[styles.counter, { color: c.walletSubtle }]}>{description.length}/2000</Text></View>
              <TextInput testID="help-description" editable={!saving} accessibilityLabel="Description" value={description} onChangeText={setDescription} multiline maxLength={2000} placeholder="Tell us what happened and how we can help…" placeholderTextColor={c.walletSubtle} keyboardAppearance={scheme} textAlignVertical="top" style={[styles.input, styles.description, { color: c.walletInk, backgroundColor: c.walletField }]} />
            </View>
            <View style={styles.field}>
              <View style={styles.between}>{label('Attachments')}<Text style={[styles.counter, { color: c.walletSubtle }]}>Optional · {attachments.length}/3</Text></View>
              {!saving && <TicketUploader value={attachments} onChange={setAttachments} onBusyChange={setUploadBusy} />}
            </View>
            {!!error && <Text testID="help-form-error" accessibilityRole="alert" style={[styles.message, { color: c.walletError }]}>{error}</Text>}
            {blocked && <Text accessibilityRole="alert" style={[styles.message, { color: loadError ? c.walletError : c.walletSubtle }]}>{loadError ? 'Saved tickets could not load, so new tickets are paused. Go back and retry.' : 'Loading saved tickets…'}</Text>}
            <Pressable testID="help-submit" disabled={uploadBusy || saving || blocked} onPress={submit} accessibilityRole="button" accessibilityState={{ disabled: uploadBusy || saving || blocked, busy: saving }} style={({ pressed }) => [styles.primary, { backgroundColor: c.walletInk, opacity: uploadBusy || saving || blocked ? .4 : pressed ? .7 : 1, transform: [{ scale: pressed ? .98 : 1 }] }]}>
              <Text style={[styles.primaryText, { color: c.walletOnInk }]}>{uploadBusy ? 'Adding attachment…' : saving ? 'Saving ticket…' : 'Create ticket'}</Text>
              <Feather name="arrow-up-right" size={18} color={c.walletOnInk} />
            </Pressable>
          </View>
        </KeyboardAwareScrollViewCompat>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottom }]}>
          <Text style={[styles.eyebrow, { color: c.walletSubtle }]}>ATHERCHAIN SUPPORT</Text>
          <Text style={[styles.title, { color: c.walletInk }]}>Here to help.</Text>
          <Text style={[styles.subtitle, { color: c.walletSubtle }]}>Your questions. A clearer way forward.</Text>
          <View style={[styles.stats, { borderColor: c.walletDisabled }]}>
            {(['Total', 'Open', 'Resolved', 'Rejected', 'Closed'] as const).map((status, index) => <View key={status} style={[styles.stat, index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.walletDisabled }]}>
              <Text testID={`help-stat-${status.toLowerCase()}`} style={[styles.statNumber, { color: c.walletInk }]}>{loading ? '–' : status === 'Total' ? tickets.length : tickets.filter(ticket => ticket.status === status).length}</Text>
              <Text style={[styles.statLabel, { color: c.walletSubtle }]}>{status}</Text>
            </View>)}
          </View>
          {loadError ? <View style={[styles.loadError, { borderColor: c.walletDisabled }]}>
            <Text testID="help-load-error" accessibilityRole="alert" style={[styles.message, { color: c.walletError, marginTop: 0, flex: 1 }]}>Could not load your saved tickets. {loadError}</Text>
            <Pressable testID="help-retry" onPress={retry} disabled={retrying} accessibilityRole="button" style={({ pressed }) => [styles.smallButton, { opacity: retrying ? .4 : pressed ? .6 : 1 }]}><Text style={[styles.label, { color: c.walletInk }]}>{retrying ? 'Retrying…' : 'Retry'}</Text></Pressable>
          </View> : null}
          <Pressable testID="help-create" disabled={blocked} onPress={() => setCreating(true)} accessibilityRole="button" accessibilityState={{ disabled: blocked }} style={({ pressed }) => [styles.primary, { backgroundColor: c.walletInk, opacity: blocked ? .4 : pressed ? .7 : 1, transform: [{ scale: pressed ? .98 : 1 }] }]}>
            <Text style={[styles.primaryText, { color: c.walletOnInk }]}>Create ticket</Text><Feather name="arrow-right" size={18} color={c.walletOnInk} />
          </Pressable>
          <View style={[styles.between, styles.listHeader]}>
            <Text style={[styles.sectionTitle, { color: c.walletInk }]}>Your tickets</Text>
            <TicketFilter value={filter} onChange={setFilter} />
          </View>
          <View>
            {loading ? [0, 1, 2].map(i => <View key={i} style={[styles.ticket, { borderBottomColor: c.walletDisabled }]}><View style={[styles.skel, { width: '30%', backgroundColor: c.walletField }]} /><View style={[styles.skel, { width: '80%', height: 16, backgroundColor: c.walletField }]} /></View>) : loadError ? null : visible.length ? visible.map(ticket => <Pressable key={ticket.id} testID={`help-ticket-${ticket.id}`} onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: ticket.id } })} accessibilityRole="button" accessibilityLabel={`${ticket.subject}, ${ticket.status}`} style={({ pressed }) => [styles.ticket, { borderBottomColor: c.walletDisabled, opacity: pressed ? .55 : 1 }]}>
              <View style={styles.between}><Text style={[styles.ticketId, { color: c.walletSubtle }]}>{ticket.id}</Text>{badge(ticket.status)}</View>
              <View style={styles.ticketTitleRow}><Text numberOfLines={2} style={[styles.ticketTitle, { color: c.walletInk }]}>{ticket.subject}</Text><Feather name="arrow-up-right" size={18} color={c.walletSubtle} /></View>
              <Text style={[styles.ticketDate, { color: c.walletSubtle }]}>{ticket.date}{ticket.attachments.length ? ` · ${ticket.attachments.length} attachment${ticket.attachments.length > 1 ? 's' : ''}` : ''}</Text>
            </Pressable>) : <View style={styles.empty}><Feather name="inbox" size={28} color={c.walletSubtle} /><Text style={[styles.label, { color: c.walletInk }]}>No {filter.toLowerCase()} tickets</Text><Text style={[styles.subtitle, { color: c.walletSubtle }]}>Your tickets will appear here.</Text></View>}
          </View>
        </ScrollView>
      )}
      <Modal visible={discard} transparent animationType="fade" onRequestClose={() => setDiscard(false)}>
        {discard && <ToastSurface>
        <View style={[styles.dialogScrim, { backgroundColor: c.walletScrim }]}>
          <View accessibilityViewIsModal style={[styles.discard, { backgroundColor: c.walletSheet }]}>
            <Text style={[styles.sectionTitle, { color: c.walletInk }]}>Discard this draft?</Text>
            <Text style={[styles.subtitle, { color: c.walletSubtle }]}>Your subject, description and attachments will be cleared.</Text>
            <View style={styles.between}>
              <Pressable testID="help-keep-draft" onPress={() => setDiscard(false)} style={styles.smallButton} accessibilityRole="button"><Text style={[styles.label, { color: c.walletInk }]}>Keep editing</Text></Pressable>
              <Pressable testID="help-discard-draft" onPress={closeForm} style={styles.smallButton} accessibilityRole="button"><Text style={[styles.label, { color: c.walletError }]}>Discard</Text></Pressable>
            </View>
          </View>
        </View>
        </ToastSurface>}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { height: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 30 },
  eyebrow: { fontSize: 10, letterSpacing: 1.5, fontFamily: 'DMSans_500Medium' },
  title: { fontSize: 32, letterSpacing: -1.3, lineHeight: 40, fontFamily: 'DMSans_600SemiBold', marginTop: 10 },
  subtitle: { fontSize: 13, lineHeight: 21, fontFamily: 'DMSans_400Regular', marginTop: 5 },
  stats: { flexDirection: 'row', marginTop: 30, marginBottom: 24, paddingVertical: 20, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20 },
  stat: { flex: 1, alignItems: 'center', gap: 7 },
  statNumber: { fontSize: 27, fontFamily: 'DMSans_500Medium', letterSpacing: -1 },
  statLabel: { fontSize: 11, fontFamily: 'DMSans_400Regular' },
  primary: { minHeight: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 18 },
  primaryText: { fontSize: 16, fontFamily: 'DMSans_500Medium' },
  listHeader: { marginTop: 28, marginBottom: 0 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontFamily: 'DMSans_600SemiBold', letterSpacing: -.5 },
  ticket: { paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  ticketId: { fontSize: 11, fontFamily: 'DMSans_500Medium' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 10, fontFamily: 'DMSans_500Medium' },
  ticketTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ticketTitle: { flex: 1, fontSize: 14, lineHeight: 21, fontFamily: 'DMSans_500Medium', letterSpacing: -.2 },
  ticketDate: { fontSize: 11, fontFamily: 'DMSans_400Regular' },
  form: { marginTop: 30, gap: 24 },
  field: { gap: 10 },
  label: { fontSize: 13, fontFamily: 'DMSans_500Medium' },
  input: { minHeight: 56, borderRadius: 15, paddingHorizontal: 16, paddingVertical: 17, fontFamily: 'DMSans_400Regular', fontSize: 14 },
  description: { minHeight: 140, lineHeight: 22 },
  counter: { fontSize: 11, fontFamily: 'DMSans_400Regular' },
  message: { fontSize: 12, lineHeight: 19, fontFamily: 'DMSans_400Regular', marginTop: 8 },
  discard: { width: '100%', maxWidth: 360, padding: 18, borderRadius: 16, gap: 10 },
  dialogScrim: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  smallButton: { minHeight: 44, justifyContent: 'center' },
  loadError: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, marginTop: 24, marginBottom: -8 },
  skel: { height: 10, borderRadius: 5 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
});
