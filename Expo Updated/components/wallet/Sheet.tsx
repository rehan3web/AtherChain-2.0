import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { EASE_OUT, useReducedMotion } from './primitives';
import { ToastSurface } from '@/components/toast/ToastProvider';

/* Bottom sheet: fades a scrim, slides up, drag the handle down to dismiss. */
export function Sheet({
  open,
  title,
  onClose,
  onExited,
  fullScreen = false,
  surface,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onExited: () => void;
  fullScreen?: boolean;
  surface?: 'page' | 'sheet';
  children: ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const H = Dimensions.get('window').height;
  const [visible, setVisible] = useState(open);
  const y = useRef(new Animated.Value(H)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useEffect(() => {
    if (open) {
      setVisible(true);
      y.setValue(H);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: reduce ? 0 : 200, easing: EASE_OUT, useNativeDriver: true }),
        Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 26, stiffness: 260, mass: 0.9 }),
      ]).start();
    } else if (visible) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: reduce ? 0 : 200, easing: EASE_OUT, useNativeDriver: true }),
        Animated.timing(y, { toValue: H, duration: reduce ? 0 : 240, easing: EASE_OUT, useNativeDriver: true }),
      ]).start(() => {
        setVisible(false);
        onExitedRef.current();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
      onPanResponderMove: (_, g) => y.setValue(g.dy > 0 ? g.dy : g.dy * 0.1),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.6) {
          onCloseRef.current();
          // If close was locked, spring back
          setTimeout(() => Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start(), 0);
        } else {
          Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    }),
  ).current;

  const bottomPad = Math.max(20, insets.bottom, Platform.OS === 'web' ? 34 : 0);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {visible && <ToastSurface>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.walletScrim, opacity: fade }]}>
          <Pressable
            style={styles.fill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss sheet"
            testID="wallet-sheet-backdrop"
          />
        </Animated.View>
        <View style={styles.anchor} pointerEvents="box-none">
          <Animated.View
            testID="wallet-sheet-surface"
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: fullScreen && surface !== 'sheet' ? c.miningPage : c.walletSheet,
                maxHeight: H * 0.94 - (Platform.OS === 'web' ? 67 : insets.top),
                ...(fullScreen ? {
                  height: '100%' as const,
                  maxHeight: '100%' as const,
                  maxWidth: '100%' as const,
                  borderRadius: 0,
                  shadowOpacity: 0,
                  elevation: 0,
                } : {}),
                transform: [{ translateY: y }],
              },
            ]}
          >
            <View {...(fullScreen ? {} : pan.panHandlers)} style={[styles.header, fullScreen && { paddingHorizontal: 16, paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 24 }]}>
              {!fullScreen && <View style={[styles.handle, { backgroundColor: c.walletDisabled }]} />}
              <View style={[styles.titleRow, fullScreen && { height: 60, marginTop: 0, justifyContent: 'center' }]}>
                <Text accessibilityRole="header" style={[styles.title, { color: c.walletInk }]}>
                  {title}
                </Text>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  testID="wallet-sheet-close"
                  hitSlop={6}
                  style={({ pressed }) => [styles.close, fullScreen && { position: 'absolute', left: 0, marginRight: 0 }, pressed && { transform: [{ scale: 0.94 }] }]}
                >
                  <Feather name="x" size={fullScreen ? 24 : 22} color={fullScreen ? c.walletInk : c.walletSubtle} />
                </Pressable>
              </View>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={fullScreen ? { flex: 1 } : undefined}
              contentContainerStyle={{ paddingHorizontal: fullScreen ? 24 : 20, paddingBottom: bottomPad, ...(fullScreen ? { flexGrow: 1 } : {}) }}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
      </ToastSurface>}
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Stay in normal layout so KeyboardAvoidingView's bottom padding lifts the sheet.
  // An absolute bottom: 0 anchor ignores that padding and sits behind the keyboard.
  anchor: { flex: 1, minHeight: 0, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    flexShrink: 1,
    maxWidth: 520,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
  },
  header: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 24 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  titleRow: {
    marginTop: 4,
    height: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontFamily: 'DMSans_600SemiBold', letterSpacing: -0.2 },
  close: { width: 44, height: 44, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
});
