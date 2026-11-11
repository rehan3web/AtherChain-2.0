import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, GestureResponderEvent, LayoutChangeEvent, Platform, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tabs } from 'expo-router';
import tw from 'twrnc';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/components/wallet/primitives';

type IconName = React.ComponentProps<typeof Feather>['name'];
type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
export const DOCK_ITEMS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  wallet: { label: 'Wallet', icon: 'credit-card' },
  search: { label: 'Mining', icon: 'cpu' },
  settings: { label: 'Settings', icon: 'settings' },
};

/* geometry: padding 12 + 44 item + 12 */
const ITEM = 44;
const DOCK_HEIGHT = 68;
const GAP_ABOVE_EDGE = 8;

/** Space a screen must reserve below its content so nothing sits under the dock. */
export function useDockClearance() {
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === 'web' ? 34 : insets.bottom;
  return { offset: bottom + GAP_ABOVE_EDGE, clearance: bottom + GAP_ABOVE_EDGE + DOCK_HEIGHT + 12 };
}

const SPRING = Easing.bezier(0.24, 1.34, 0.38, 1);
const TIP = Easing.bezier(0.22, 1, 0.36, 1);

function DockItem({
  icon, label, f, active, near, lift, magnify, reduce, testID, ink, onActivate,
}: {
  icon: IconName; label: string; f: number; active: boolean; near: number;
  lift: number; magnify: number; reduce: boolean; testID: string; ink: string; onActivate: () => void;
}) {
  const v = useRef(new Animated.Value(f)).current;
  const dot = useRef(new Animated.Value(active ? 1 : 0)).current;
  const op = useRef(new Animated.Value(0.42)).current;
  const opTarget = active || near === 0 ? 1 : near === 1 ? 0.66 : 0.42;
  useEffect(() => {
    Animated.timing(v, { toValue: reduce ? 0 : f, duration: reduce ? 0 : 420, easing: SPRING, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [f, reduce, v]);
  useEffect(() => {
    Animated.timing(dot, { toValue: active ? 1 : 0, duration: reduce ? 0 : 420, easing: SPRING, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [active, reduce, dot]);
  useEffect(() => {
    Animated.timing(op, { toValue: opTarget, duration: reduce ? 0 : 220, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [opTarget, reduce, op]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, magnify] });
  // transform-origin bottom: shift up by half the growth of the 20px glyph
  const ty = v.interpolate({ inputRange: [0, 1], outputRange: [0, -lift - (20 * (magnify - 1)) / 2] });
  return (
    <View
      testID={testID}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onAccessibilityTap={onActivate}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={onActivate}
      style={tw`w-11 h-11 items-center justify-center`}
    >
      <Animated.View style={{ opacity: op, transform: [{ translateY: ty }, { scale }] }}>
        <Feather name={icon} size={20} color={ink} />
      </Animated.View>
      <Animated.View
        style={[
          tw`absolute bottom-[3px] w-[3px] h-[3px] rounded-full`,
          { backgroundColor: ink, opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }), transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
        ]}
      />
    </View>
  );
}

export function GlassDock({
  state, descriptors, emitter, navigateToTab, magnify = 1.32, spread = 2, lift = 8, labels = true,
}: BottomTabBarProps & { magnify?: number; spread?: number; lift?: number; labels?: boolean }) {
  const c = useColors();
  const { scheme } = useTheme();
  const reduce = useReducedMotion();
  const { offset } = useDockClearance();
  const routes = state.routes.filter((r) => DOCK_ITEMS[r.name]);
  const [hover, setHover] = useState<number | null>(null);

  /* measured geometry: item centres within the bar, bar origin in window */
  const centers = useRef<number[]>([]);
  const barRef = useRef<React.ComponentRef<typeof View>>(null);
  const barX = useRef(0);
  const down = useRef(false);
  const measureBar = () => barRef.current?.measureInWindow((x) => { barX.current = x; });

  const at = (pageX: number) => {
    const xs = centers.current;
    if (!xs.length) return null;
    const x = pageX - barX.current;
    let best = 0, gap = Infinity;
    xs.forEach((cx, i) => { const d = Math.abs(x - cx); if (d < gap) { gap = d; best = i; } });
    return best;
  };

  const choose = (i: number) => {
    const route = routes[i];
    if (!route) return;
    const focused = state.routes[state.index]?.key === route.key;
    const ev = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !ev.defaultPrevented) navigateToTab(route.key);
  };

  const pressStart = useRef<{ t: number; i: number | null }>({ t: 0, i: null });
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearLong = () => { if (longTimer.current) clearTimeout(longTimer.current); longTimer.current = null; };

  const onGrant = (e: GestureResponderEvent) => {
    down.current = true;
    measureBar();
    const i = at(e.nativeEvent.pageX);
    pressStart.current = { t: Date.now(), i };
    setHover(i);
    clearLong();
    longTimer.current = setTimeout(() => {
      const r = i !== null ? routes[i] : null;
      if (r && down.current) emitter.emit({ type: 'tabLongPress', target: r.key });
    }, 500);
  };
  const onMove = (e: GestureResponderEvent) => {
    if (!down.current) return;
    const i = at(e.nativeEvent.pageX);
    if (i !== pressStart.current.i) clearLong();
    setHover(i);
  };
  const onRelease = (e: GestureResponderEvent) => {
    clearLong();
    const i = at(e.nativeEvent.pageX);
    down.current = false;
    setHover(null);
    if (i !== null) choose(i);
  };
  const onCancel = () => { clearLong(); down.current = false; setHover(null); };

  /* web mouse hover: magnify without a press */
  const webHover = Platform.OS === 'web'
    ? ({
        onPointerMove: (e: { nativeEvent: { pointerType?: string; pageX?: number; clientX?: number } }) => {
          if (down.current || e.nativeEvent.pointerType !== 'mouse') return;
          setHover(at(e.nativeEvent.pageX ?? e.nativeEvent.clientX ?? 0));
        },
        onPointerEnter: measureBar,
        onPointerLeave: () => { if (!down.current) setHover(null); },
      } as object)
    : {};

  /* ONE travelling tip */
  const [wordW, setWordW] = useState<Record<number, number>>({});
  const [last, setLast] = useState(0);
  if (hover !== null && hover !== last) setLast(hover);
  const tipX = useRef(new Animated.Value(0)).current;
  const tipW = useRef(new Animated.Value(48)).current;
  const tipO = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const [layoutTick, setLayoutTick] = useState(0);
  useEffect(() => {
    const cx = centers.current[last];
    const ww = wordW[last];
    if (cx === undefined || ww === undefined) return;
    const w = Math.ceil(ww) + 24;
    const x = cx - w / 2;
    const d = placed.current && !reduce ? 160 : 0;
    placed.current = true;
    Animated.parallel([
      Animated.timing(tipX, { toValue: x, duration: d, easing: TIP, useNativeDriver: false }),
      Animated.timing(tipW, { toValue: w, duration: d, easing: TIP, useNativeDriver: false }),
    ]).start();
  }, [last, wordW, layoutTick, reduce, tipX, tipW]);
  const tipOn = hover !== null;
  useEffect(() => {
    Animated.timing(tipO, { toValue: tipOn ? 1 : 0, duration: reduce ? 0 : 160, easing: TIP, useNativeDriver: false }).start();
  }, [tipOn, reduce, tipO]);

  const activeKey = state.routes[state.index]?.key;
  const items = useMemo(() => routes.map((r) => ({ r, ...DOCK_ITEMS[r.name] })), [routes]);

  return (
    <View pointerEvents="box-none" style={[tw`absolute left-0 right-0 items-center bg-transparent`, { bottom: offset }]}>
      <View
        ref={barRef}
        testID="glass-dock"
        accessibilityRole="tablist"
        accessibilityLabel="Dock"
        onLayout={measureBar}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => false}
        onResponderTerminationRequest={() => true}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminate={onCancel}
        {...webHover}
        style={[
          tw`rounded-[28px]`,
          { shadowColor: c.dockShadow, shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
        ]}
      >
        {/* tip */}
        {labels && (
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              tw`absolute bottom-[76px] left-0 h-8 rounded-full overflow-hidden items-center justify-center z-10`,
              { backgroundColor: c.dockInk, width: tipW, opacity: tipO, transform: [{ translateX: tipX }] },
            ]}
          >
            <Text numberOfLines={1} style={[tw`text-xs`, { color: c.dockOnInk, fontFamily: 'DMSans_400Regular', lineHeight: 32 }]}>
              {items[last]?.label}
            </Text>
          </Animated.View>
        )}
        {/* hidden measuring words */}
        <View pointerEvents="none" style={tw`absolute opacity-0 top-0 left-0`}>
          {items.map((it, i) => (
            <Text
              key={it.r.key}
              style={[tw`text-xs absolute`, { fontFamily: 'DMSans_400Regular' }]}
              onLayout={(e) => { const w = e.nativeEvent.layout.width; setWordW((p) => (p[i] === w ? p : { ...p, [i]: w })); }}
            >
              {it.label}
            </Text>
          ))}
        </View>

        <View style={tw`rounded-[28px] overflow-hidden`}>
          <BlurView intensity={Platform.OS === 'web' ? 12 : 24} tint={scheme} style={tw`absolute inset-0`} />
          <View style={[tw`absolute inset-0`, { backgroundColor: c.dockPane }]} />
          {/* lit rim: gradient ring, inner pane punched in */}
          <LinearGradient
            pointerEvents="none"
            colors={[c.dockRimHi, c.dockRimLo, c.dockRimLo, c.dockRimFar]}
            locations={[0, 0.26, 0.62, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.8 }}
            style={[tw`absolute inset-0 rounded-[28px]`, { padding: 1 }]}
          >
            <View style={[tw`flex-1 rounded-[27px]`, { backgroundColor: c.dockPane }]} />
          </LinearGradient>
          <View pointerEvents="none" style={[tw`absolute top-[1px] left-5 right-5 h-px`, { backgroundColor: c.dockSpec }]} />
          <View style={tw`flex-row items-end gap-3 px-4 py-3`}>
            {items.map((it, i) => {
              const d = hover === null ? 99 : Math.abs(i - hover);
              const f = d > spread ? 0 : (1 + Math.cos((Math.PI * d) / (spread + 1))) / 2;
              const opts = descriptors[it.r.key]?.options;
              return (
                <View
                  key={it.r.key}
                  onLayout={(e: LayoutChangeEvent) => {
                    const { x, width } = e.nativeEvent.layout;
                    centers.current[i] = x + width / 2;
                    setLayoutTick((t) => t + 1);
                  }}
                  style={tw`w-[${ITEM}px] h-[${ITEM}px]`}
                >
                  <DockItem
                    icon={it.icon}
                    label={opts?.tabBarAccessibilityLabel ?? it.label}
                    f={f}
                    near={d}
                    active={it.r.key === activeKey}
                    lift={lift}
                    magnify={magnify}
                    reduce={reduce}
                    ink={c.dockInk}
                    onActivate={() => choose(i)}
                    testID={opts?.tabBarButtonTestID ?? `dock-${it.r.name}`}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}
