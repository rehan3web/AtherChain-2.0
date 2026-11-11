import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { searchLanguages, type Language } from './languages';
import { searchCountries } from './countries';
import { CountryFlag } from './CountryFlag';

type PickerProps = {
  open: boolean; value: string; onClose: () => void; onSelect: (code: string) => void;
};
export function LanguageSheet(props: PickerProps) {
  return <SelectionSheet {...props} mode="language" />;
}
export function CountrySheet(props: PickerProps) {
  return <SelectionSheet {...props} mode="country" />;
}
function SelectionSheet({ open, value, onClose, onSelect, mode }: PickerProps & { mode: 'language' | 'country' }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  useEffect(() => { if (open) setQuery(''); }, [open]);
  const isCountry = mode === 'country';
  const items = useMemo(() => isCountry
    ? searchCountries(query).map(item => ({ ...item, nativeName: item.name, region: item.code, flag: '' }))
    : searchLanguages(query), [query, isCountry]);
  const render = ({ item }: { item: Language }) => {
    const selected = (isCountry ? item.name : item.code) === value;
    return (
      <Pressable testID={`kyc-${mode}-${item.code}`} onPress={() => onSelect(isCountry ? item.name : item.code)} accessibilityRole="radio"
        accessibilityState={{ checked: selected }} accessibilityLabel={`${item.name}, ${item.nativeName}`}
        style={({ pressed }) => [st.row, { borderBottomColor: c.walletDisabled }, pressed && { opacity: 0.6 }]}>
        <View style={[st.flag, { backgroundColor: c.walletField }]}>
          <CountryFlag code={item.region} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[st.native, { color: c.walletInk }]}>{item.nativeName}</Text>
          {!isCountry && <Text numberOfLines={1} style={[st.name, { color: c.walletSubtle }]}>{item.name}</Text>}
        </View>
        {selected && <Feather name="check" size={18} color={c.walletInk} />}
      </Pressable>
    );
  };
  return (
    <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[st.scrim, { backgroundColor: c.walletScrim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={`Dismiss ${mode} list`} />
        <View accessibilityViewIsModal style={[st.sheet, { backgroundColor: c.walletSheet, paddingBottom: Math.max(16, insets.bottom) }]}>
          <View style={[st.handle, { backgroundColor: c.walletDisabled }]} />
          <View style={st.titleRow}>
            <Text accessibilityRole="header" style={[st.title, { color: c.walletInk }]}>{isCountry ? 'Country' : 'Preferred language'}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={st.close}>
              <Feather name="x" size={22} color={c.walletSubtle} />
            </Pressable>
          </View>
          <View style={[st.search, { backgroundColor: c.walletField }]}>
            <Feather name="search" size={16} color={c.walletMuted} />
            <TextInput testID={`kyc-${mode}-search`} value={query} onChangeText={setQuery} placeholder={isCountry ? 'Search countries' : 'Search languages'}
              accessibilityLabel={isCountry ? 'Search countries' : 'Search languages'} placeholderTextColor={c.walletMuted} autoCorrect={false}
              style={[st.searchInput, { color: c.walletInk }]} />
          </View>
          <FlatList data={items} keyExtractor={i => i.code} renderItem={render} keyboardShouldPersistTaps="handled"
            initialNumToRender={20} style={{ flexGrow: 0 }}
            ListEmptyComponent={<Text style={[st.note, { color: c.walletSubtle, textAlign: 'center', paddingVertical: 32 }]}>No {isCountry ? 'countries' : 'languages'} match “{query}”.</Text>} />
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
  note: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17, marginBottom: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 14, paddingHorizontal: 14, marginBottom: 6 },
  searchInput: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15, height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  flag: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flagText: { fontSize: 20 },
  native: { fontFamily: 'DMSans_500Medium', fontSize: 15 },
  name: { fontFamily: 'DMSans_400Regular', fontSize: 12 },
});
