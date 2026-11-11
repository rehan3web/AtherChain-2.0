import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CountryFlag } from '@/components/kyc/CountryFlag';
import { searchPhoneCountries } from './phoneCountries';

type Item = { code: string; name: string; dialCode: string };
const dial = (d: string) => `+${d.replace(/^\+/, '')}`;

export function CallingCodeSheet({ open, value, onClose, onSelect }: { open: boolean; value: string; onClose: () => void; onSelect: (code: string) => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  useEffect(() => { if (open) setQuery(''); }, [open]);
  const items = useMemo(() => searchPhoneCountries(query), [query]);
  const render = ({ item }: { item: Item }) => {
    const selected = item.code === value;
    return (
      <Pressable testID={`signup-calling-${item.code}`} onPress={() => onSelect(item.code)} accessibilityRole="radio"
        accessibilityState={{ checked: selected }} accessibilityLabel={`${item.name}, ${dial(item.dialCode)}`}
        style={({ pressed }) => [st.row, { borderBottomColor: c.walletDisabled }, pressed && { opacity: 0.6 }]}>
        <View style={[st.flag, { backgroundColor: c.walletField }]}><CountryFlag code={item.code} /></View>
        <Text numberOfLines={1} style={[st.native, { flex: 1, color: c.walletInk }]}>{item.name}</Text>
        <Text style={[st.dial, { color: c.walletSubtle }]}>{dial(item.dialCode)}</Text>
        {selected && <Feather name="check" size={18} color={c.walletInk} />}
      </Pressable>
    );
  };
  return (
    <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[st.scrim, { backgroundColor: c.walletScrim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Dismiss calling code list" />
        <View accessibilityViewIsModal style={[st.sheet, { backgroundColor: c.walletSheet, paddingBottom: Math.max(16, insets.bottom) }]}>
          <View style={[st.handle, { backgroundColor: c.walletDisabled }]} />
          <View style={st.titleRow}>
            <Text accessibilityRole="header" style={[st.title, { color: c.walletInk }]}>Calling code</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={st.close}>
              <Feather name="x" size={22} color={c.walletSubtle} />
            </Pressable>
          </View>
          <View style={[st.search, { backgroundColor: c.walletField }]}>
            <Feather name="search" size={16} color={c.walletMuted} />
            <TextInput testID="signup-calling-search" value={query} onChangeText={setQuery} placeholder="Search country or code"
              accessibilityLabel="Search country or code" placeholderTextColor={c.walletMuted} autoCorrect={false}
              style={[st.searchInput, { color: c.walletInk }]} />
          </View>
          <FlatList data={items} keyExtractor={i => i.code} renderItem={render} keyboardShouldPersistTaps="handled"
            initialNumToRender={20} style={{ flexGrow: 0 }}
            ListEmptyComponent={<Text style={[st.note, { color: c.walletSubtle }]}>No countries match “{query}”.</Text>} />
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: Platform.OS === 'web' ? '85%' : '88%', height: '85%', width: '100%', maxWidth: 520, alignSelf: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' },
  titleRow: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'DMSans_600SemiBold', fontSize: 18 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  note: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17, textAlign: 'center', paddingVertical: 32 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 14, paddingHorizontal: 14, marginBottom: 6 },
  searchInput: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15, height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  flag: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  native: { fontFamily: 'DMSans_500Medium', fontSize: 15 },
  dial: { fontFamily: 'DMSans_500Medium', fontSize: 14, fontVariant: ['tabular-nums'] },
});
