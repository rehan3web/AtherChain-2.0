import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Photo } from './model';

const size = (n?: number) => (n == null ? 'Size unknown' : `${(n / 1e6).toFixed(1)} MB`);

/** Help Center–style rounded zone: library or camera, then thumbnail row with remove. */
export function PhotoSlot({ side, photo, busy, onPick, onRemove }: {
  side: 'front' | 'back'; photo: Photo | null; busy: boolean;
  onPick: (src: 'library' | 'camera') => void; onRemove: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 12 }}>
      {photo ? (
        <View style={[st.preview, { backgroundColor: c.walletField }]}>
          <Image source={{ uri: photo.uri }} style={st.big} resizeMode="cover" accessibilityLabel={`${side} of document preview`} />
          <View style={st.fileRow}>
            <Image source={{ uri: photo.uri }} style={st.thumb} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[st.name, { color: c.walletInk }]}>{photo.name}</Text>
              <Text style={[st.meta, { color: c.walletSubtle }]}>{size(photo.size)} · Kept on this device</Text>
            </View>
            <Pressable testID={`kyc-${side}-remove`} disabled={busy} onPress={onRemove} accessibilityRole="button"
              accessibilityLabel={`Remove ${side} photo`} style={st.remove}>
              <Feather name="x" size={18} color={c.walletSubtle} />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[st.zone, { backgroundColor: c.walletField }]}>
          <View style={[st.icon, { backgroundColor: c.walletFieldPressed }]}><Feather name="image" size={20} color={c.walletInk} /></View>
          <Text style={[st.title, { color: c.walletInk }]}>{`Add the ${side} of your document`}</Text>
          <Text style={[st.meta, { color: c.walletSubtle }]}>Images only · Up to 5 MB</Text>
        </View>
      )}
      <View style={st.actions}>
        {(['library', 'camera'] as const).map(src => (
          <Pressable key={src} testID={`kyc-${side}-${src}`} disabled={busy} onPress={() => onPick(src)} accessibilityRole="button"
            accessibilityLabel={`${photo ? 'Replace' : 'Add'} ${side} photo from ${src === 'library' ? 'photo library' : 'camera'}`}
            style={({ pressed }) => [st.action, { backgroundColor: c.walletField, opacity: busy ? 0.5 : 1 }, pressed && { transform: [{ scale: 0.97 }] }]}>
            {busy ? <ActivityIndicator testID={`kyc-${side}-${src}-loading`} color={c.walletInk} />
              : <Feather name={src === 'library' ? 'upload' : 'camera'} size={16} color={c.walletInk} />}
            <Text style={[st.actionText, { color: c.walletInk }]}>{photo ? (src === 'library' ? 'Replace' : 'Retake') : (src === 'library' ? 'Upload' : 'Take photo')}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  zone: { height: 190, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 8 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontFamily: 'DMSans_500Medium', fontSize: 14 },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17 },
  preview: { borderRadius: 22, padding: 10, gap: 10 },
  big: { width: '100%', height: 170, borderRadius: 16 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 4 },
  thumb: { width: 40, height: 40, borderRadius: 10 },
  name: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14 },
});
