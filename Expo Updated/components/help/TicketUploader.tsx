import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import type { Attachment } from './tickets';
import { useToast } from '@/components/toast/ToastProvider';

const LIMIT = 5e6;
const formatSize = (size: number) => `${(size / 1e6).toFixed(1)} MB`;

function FileMark({ file }: { file: Attachment }) {
  const c = useColors();
  return (
    <View style={styles.fileMark}>
      <Feather name="file" size={38} color={c.walletMuted} />
      <View style={[styles.extension, { backgroundColor: file.kind === 'MP4' ? c.primary : c.walletPositive }]}>
        <Text style={[styles.extensionText, { color: c.walletOnBlue }]}>{file.kind}</Text>
      </View>
    </View>
  );
}

export function TicketUploader({ value, onChange, onBusyChange }: {
  value: Attachment[]; onChange: (files: Attachment[]) => void; onBusyChange: (busy: boolean) => void;
}) {
  const c = useColors();
  const { showToast } = useToast();
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useRef(false);
  const [pending, setPending] = useState<Attachment | null>(null);
  const [picking, setPicking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const busy = !!pending || picking;
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(value => { reduced.current = value; });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduced.current = value; });
    return () => subscription.remove();
  }, []);
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  useEffect(() => {
    if (!pending) return;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setProgress(step / 12);
      if (step >= 12) {
        clearInterval(timer);
        onChange([...value, pending]);
        showToast({ kind: 'success', title: 'Attachment added', body: pending.name });
        setPending(null);
      }
    }, 70);
    return () => clearInterval(timer);
  }, [pending, value, onChange, showToast]);
  const fail = (message: string) => {
    setError(message);
    showToast({ kind: 'error', title: 'Could not attach file', body: message });
  };
  const add = (file: Attachment) => {
    if (busy) return;
    setError('');
    if (file.size > LIMIT) { fail('This file is too large. Choose a file under 5 MB.'); return; }
    if (value.length >= 3) { fail('You can attach up to 3 files.'); return; }
    if (value.some(item => item.id === file.id)) { fail('This file is already attached.'); return; }
    setProgress(0);
    setPending(file);
    if (!reduced.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: .975, duration: 120, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }
  };
  const pick = async () => {
    if (busy) return;
    setError('');
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1 });
      if (!result.canceled) {
        const asset = result.assets[0];
        if (asset.fileSize == null) { fail('Could not check the file size. Please choose another file.'); return; }
        add({ id: asset.uri, uri: asset.uri, name: asset.fileName ?? 'Attachment', size: asset.fileSize, kind: asset.type === 'video' ? 'MP4' : 'IMG' });
      }
    } catch {
      fail('Could not open your photos. Please try again.');
    } finally { setPicking(false); }
  };
  return (
    <View style={styles.root}>
      <Animated.View style={[styles.zone, { backgroundColor: c.walletField, transform: [{ scale }] }]}>
        {pending ? (
          <View accessibilityLiveRegion="polite" style={styles.uploading}>
            <FileMark file={pending} />
            <View style={styles.uploadText}>
              <Text numberOfLines={1} style={[styles.fileName, { color: c.walletInk }]}>{pending.name}</Text>
              <Text style={[styles.meta, { color: c.walletSubtle }]}>{formatSize(pending.size)} · Adding {Math.round(progress * 100)}%</Text>
              <View style={[styles.track, { backgroundColor: c.walletDisabled }]}>
                <View style={{ height: 4, width: `${Math.min(progress, 1) * 100}%`, backgroundColor: c.walletInk, borderRadius: 2 }} />
              </View>
            </View>
          </View>
        ) : (
          <Pressable testID="help-upload-zone" onPress={pick} disabled={busy} accessibilityRole="button" accessibilityLabel="Choose an image or video attachment" style={styles.zoneButton}>
            <View style={[styles.uploadIcon, { backgroundColor: c.walletFieldPressed }]}><Feather name="upload" size={18} color={c.walletInk} /></View>
            <Text style={[styles.dropTitle, { color: c.walletInk }]}>{picking ? 'Opening photos…' : 'Choose a file to attach'}</Text>
            <Text style={[styles.meta, { color: c.walletSubtle }]}>Images & videos · Up to 5 MB</Text>
          </Pressable>
        )}
      </Animated.View>
      {!!error && <Text accessibilityRole="alert" testID="help-upload-error" style={[styles.error, { color: c.walletError }]}>{error}</Text>}
      {value.map(file => (
        <View key={file.id} testID="help-attachment" style={[styles.attached, { borderBottomColor: c.walletDisabled }]}>
          <FileMark file={file} />
          <View style={styles.uploadText}>
            <Text numberOfLines={1} style={[styles.fileName, { color: c.walletInk }]}>{file.name}</Text>
            <Text style={[styles.meta, { color: c.walletSubtle }]}>{formatSize(file.size)} · Attached</Text>
          </View>
          <Pressable disabled={busy} onPress={() => onChange(value.filter(item => item.id !== file.id))} accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} style={styles.remove}>
            <Feather name="x" size={17} color={c.walletSubtle} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  zone: { height: 176, width: '100%', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  zoneButton: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 9 },
  uploadIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 3 },
  dropTitle: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17 },
  fileMark: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  extension: { position: 'absolute', left: -1, bottom: 8, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  extensionText: { fontFamily: 'DMSans_600SemiBold', fontSize: 9 },
  error: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18 },
  uploading: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingHorizontal: 24, width: '100%' },
  uploadText: { flex: 1, minWidth: 0, gap: 3 },
  fileName: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 5 },
  attached: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
