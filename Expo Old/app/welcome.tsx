import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { PrimaryButton } from '@/components/auth/PrimaryButton';

const SCREEN_W = Dimensions.get('window').width;
// Frame takes 78% of screen width
const FRAME_W = Math.min(SCREEN_W * 0.78, 310);
// Image is portrait phone photo — maintain aspect ratio of original (827×1024 approx)
const IMG_ASPECT = 827 / 1024;
const IMG_W = FRAME_W - 16; // inner padding
const IMG_H = IMG_W / IMG_ASPECT;
// Show top 70% of the image, hide bottom 30%
const VISIBLE_H = IMG_H * 0.70;

const SLIDES = [
  {
    id: '1',
    title: 'Verified Human Network',
    description: 'Ather Chain is built for verified humans — earn daily rewards, own your on-chain assets, and experience a secure self-hosted blockchain. Simple. Reliable. No seed phrases.',
    image: require('../assets/images/dashboard.png'),
    pills: ['Daily Rewards', 'Mine ATH', 'No Seed Phrases'],
  },
  {
    id: '2',
    title: 'AtherChain Wallet',
    description: 'Securely store, send, and receive ATH tokens with the official AtherChain Wallet. Fast, secure, and built exclusively for the AtherChain ecosystem.',
    image: require('../assets/images/1.png'),
    pills: ['Secure Storage', 'Send & Receive', 'Fast'],
  },
  {
    id: '3',
    title: 'AtherChain Swap',
    description: 'Instantly swap AT to ATH with a fast, secure, and seamless experience. Designed exclusively for the AtherChain ecosystem.',
    image: require('../assets/images/2.png'),
    pills: ['Instant Swap', 'Seamless', 'Secure'],
  }
];

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 52 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const [activeIndex, setActiveIndex] = React.useState(0);

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== activeIndex) {
      setActiveIndex(roundIndex);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── scrollable upper area ── */}
      <View style={[styles.upper, { paddingTop: topPad + 20 }]}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={{ flex: 1, width: SCREEN_W }}
        >
          {SLIDES.map((slide) => (
            <View key={slide.id} style={{ width: SCREEN_W, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
              {/* ── outer frame box ── */}
              <View style={[styles.outerFrame, { borderColor: colors.border }]}>
                <View style={[styles.innerFrame, { width: IMG_W, height: VISIBLE_H }]}>
                  <Image
                    source={slide.image as any}
                    style={{ width: IMG_W, height: IMG_H, marginTop: 16 }}
                    resizeMode="contain"
                  />
                </View>
                <LinearGradient
                  colors={['transparent', colors.background]}
                  style={styles.fadeOverlay}
                  pointerEvents="none"
                />
              </View>

              {/* ── description below image ── */}
              <View style={styles.desc}>
                <Text style={[styles.descTitle, { color: colors.text }]}>
                  {slide.title}
                </Text>
                <Text style={[styles.descBody, { color: colors.mutedForeground }]}>
                  {slide.description}
                </Text>
                <View style={styles.pills}>
                  {slide.pills.map(label => (
                    <View
                      key={label}
                      style={[styles.pill, { backgroundColor: colors.primaryPale, borderColor: colors.primaryNeutral }]}
                    >
                      <Text style={[styles.pillText, { color: colors.primary }]}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
        {/* ── pagination dots ── */}
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === activeIndex ? colors.primary : colors.border },
                i === activeIndex && styles.activeDot
              ]}
            />
          ))}
        </View>
      </View>

      {/* ── sticky footer CTAs ── */}
      <View style={[styles.footer, { paddingBottom: bottomPad + 16 }]}>
        <PrimaryButton title="Create Account" onPress={() => router.push('/register' as any)} />
        <View style={{ height: 12 }} />
        <PrimaryButton title="Log In" onPress={() => router.push('/login' as any)} variant="secondary" />
        <TouchableOpacity style={styles.termsBtn} activeOpacity={0.7}>
          <Text style={[styles.termsText, { color: colors.mutedForeground }]}>
            By continuing, you agree to our{' '}
            <Text style={{ color: colors.primary }}>Terms</Text>
            {' '}&{' '}
            <Text style={{ color: colors.primary }}>Privacy Policy</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  upper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* outer frame — visible border box */
  outerFrame: {
    borderWidth: 1.5,
    borderRadius: 28,
    padding: 7,
    marginTop: 24,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#111',
  },

  /* inner frame — clips the image to top 70% */
  innerFrame: {
    borderRadius: 20,
    overflow: 'hidden',
  },

  /* fade overlay sits at bottom of outer frame */
  fadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },

  desc: { alignSelf: 'stretch', alignItems: 'center' },
  descTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  descBody: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
    textAlign: 'center',
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },

  footer: { paddingHorizontal: 24, paddingTop: 8 },
  termsBtn: { marginTop: 14, alignItems: 'center' },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
  },
});
