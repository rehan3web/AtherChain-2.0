import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import colors from '@/constants/colors';

type Mode = 'system' | 'light' | 'dark';
type IconName = React.ComponentProps<typeof Feather>['name'];

const OPTIONS: { mode: Mode; label: string; icon: IconName }[] = [
  { mode: 'system', label: 'System', icon: 'monitor' },
  { mode: 'light', label: 'Light', icon: 'sun' },
  { mode: 'dark', label: 'Dark', icon: 'moon' },
];

/** Tiny phone-style preview: light, dark, or split for system. */
function MiniPreview({ mode }: { mode: Mode }) {
  const lightBg = colors.light.background;
  const lightInk = colors.light.walletInk;
  const darkBg = colors.dark.background;
  const darkInk = colors.dark.walletInk;
  const half = (bg: string, ink: string) => (
    <View style={{ flex: 1, backgroundColor: bg, padding: 5, justifyContent: 'flex-start' }}>
      <View style={{ height: 4, width: '70%', borderRadius: 2, backgroundColor: ink, opacity: 0.85 }} />
      <View style={{ height: 3, width: '45%', borderRadius: 2, backgroundColor: ink, opacity: 0.35, marginTop: 4 }} />
    </View>
  );
  return (
    <View style={{ height: 40, width: '100%', borderRadius: 8, overflow: 'hidden', flexDirection: 'row' }}>
      {mode === 'dark' ? half(darkBg, darkInk) : half(lightBg, lightInk)}
      {mode === 'system' && half(darkBg, darkInk)}
    </View>
  );
}

export function AppearancePanel() {
  const c = useColors();
  const { preference, ready, saving, error, setTheme } = useTheme();
  const disabled = !ready || saving;

  return (
    <View testID="appearance-panel" style={{ paddingTop: 8, paddingBottom: 8 }}>
      <Text style={{ color: c.walletSubtle, fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
        Choose how AtherChain looks. System follows your device setting.
      </Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
        {OPTIONS.map(({ mode, label, icon }) => {
          const selected = preference === mode;
          return (
            <Pressable
              key={mode}
              testID={`appearance-${mode}`}
              onPress={() => { if (!disabled && !selected) void setTheme(mode); }}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityLabel={`${label} appearance`}
              accessibilityState={{ checked: selected, selected, disabled }}
              style={({ pressed }) => [{
                flex: 1, minWidth: 0, borderRadius: 16, padding: 10, gap: 10,
                backgroundColor: c.walletField, borderWidth: 2,
                borderColor: selected ? c.walletInk : 'transparent',
                opacity: disabled && !selected ? 0.55 : 1,
              }, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <MiniPreview mode={mode} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Feather name={icon} size={15} color={c.walletInk} />
                <Text numberOfLines={2} style={{ flexShrink: 1, color: c.walletInk, fontFamily: selected ? 'DMSans_600SemiBold' : 'DMSans_500Medium', fontSize: 14 }}>{label}</Text>
              </View>
              <View style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.walletInk : 'transparent', borderWidth: selected ? 0 : 1.5, borderColor: c.walletMuted }}>
                {selected && <Feather name="check" size={12} color={c.walletOnInk} />}
              </View>
            </Pressable>
          );
        })}
      </View>
      {saving && (
        <View testID="appearance-saving" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <ActivityIndicator size="small" color={c.walletMuted} />
          <Text style={{ color: c.walletMuted, fontFamily: 'DMSans_400Regular', fontSize: 13 }}>Saving…</Text>
        </View>
      )}
      {error && (
        <Text testID="appearance-error" accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ color: c.walletError, fontFamily: 'DMSans_500Medium', fontSize: 14, marginTop: 14 }}>
          {error}
        </Text>
      )}
    </View>
  );
}
