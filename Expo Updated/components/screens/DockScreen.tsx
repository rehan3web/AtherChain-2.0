import React from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useColors } from '@/hooks/useColors';
import { useDockClearance } from '@/components/navigation/GlassDock';

type Props = {
  title: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  heading: string;
  body: string;
  badge?: string;
  children?: React.ReactNode;
  testID?: string;
};

/** Shared honest screen for dock destinations that have no content yet. */
export function DockScreen({ title, icon, heading, body, badge, children, testID }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { clearance } = useDockClearance();
  const top = Platform.OS === 'web' ? 67 : insets.top;
  return (
    <ScrollView
      testID={testID}
      style={{ backgroundColor: c.walletCardBottom }}
      contentContainerStyle={[tw`px-6 grow`, { paddingTop: top + 16, paddingBottom: clearance }]}
    >
      <Text style={[tw`text-[28px] tracking-tight`, { color: c.walletInk, fontFamily: 'DMSans_700Bold' }]}>{title}</Text>
      <View style={tw`flex-1 items-center justify-center py-16`}>
        <View style={[tw`w-16 h-16 rounded-[22px] items-center justify-center mb-5`, { backgroundColor: c.walletBlue[0] }]}>
          <Feather name={icon} size={26} color={c.walletBlue[4]} />
        </View>
        {badge ? (
          <View style={[tw`px-2.5 py-1 rounded-full mb-3`, { backgroundColor: c.walletDemo }]}>
            <Text style={[tw`text-[11px] uppercase tracking-wider`, { color: c.walletDemoInk, fontFamily: 'DMSans_600SemiBold' }]}>{badge}</Text>
          </View>
        ) : null}
        <Text style={[tw`text-lg text-center`, { color: c.walletInk, fontFamily: 'DMSans_600SemiBold' }]}>{heading}</Text>
        <Text style={[tw`text-sm text-center mt-2 leading-5 max-w-[280px]`, { color: c.walletSubtle, fontFamily: 'DMSans_400Regular' }]}>{body}</Text>
        {children}
      </View>
    </ScrollView>
  );
}
