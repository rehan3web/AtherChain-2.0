import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { drawOrb } from './orb-canvas';

/* Native port of the supplied canvas ThinkingOrb. Same presets, golden-spiral
   particles, spherical engine, perspective and depth alpha; drawn with SVG. */

export type ThinkingOrbState =
  | 'working' | 'searching' | 'solving' | 'listening' | 'connecting'
  | 'weaving' | 'composing' | 'breathing' | 'shaping';

export interface ThinkingOrbProps {
  state?: ThinkingOrbState;
  size?: number;
  speed?: number;
  /** true = luminous white on dark, false = graphite on light (default false). */
  dark?: boolean;
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

interface StateParam {
  energy: number; turbulence: number; rotation: number; pulse: number;
  compression: number; wave: number; drift: number; coreGlow: number;
}

const STATE_CONFIG: Record<ThinkingOrbState, StateParam> = {
  working: { energy: 0.8, turbulence: 0.2, rotation: 0.35, pulse: 0.7, compression: 1.0, wave: 0.2, drift: 0.12, coreGlow: 0.9 },
  searching: { energy: 1.15, turbulence: 0.5, rotation: 0.8, pulse: 0.55, compression: 1.02, wave: 0.45, drift: 0.28, coreGlow: 0.75 },
  solving: { energy: 1.35, turbulence: 0.7, rotation: 0.95, pulse: 0.85, compression: 0.92, wave: 0.65, drift: 0.38, coreGlow: 1.0 },
  listening: { energy: 0.4, turbulence: 0.08, rotation: 0.12, pulse: 1.2, compression: 1.04, wave: 0.06, drift: 0.03, coreGlow: 0.65 },
  connecting: { energy: 0.95, turbulence: 0.28, rotation: 1.3, pulse: 0.5, compression: 1.0, wave: 0.3, drift: 0.4, coreGlow: 0.85 },
  weaving: { energy: 1.1, turbulence: 0.6, rotation: 0.45, pulse: 0.65, compression: 0.88, wave: 0.9, drift: 0.25, coreGlow: 0.8 },
  composing: { energy: 0.75, turbulence: 0.18, rotation: 0.2, pulse: 0.9, compression: 0.75, wave: 0.35, drift: 0.1, coreGlow: 0.7 },
  breathing: { energy: 0.25, turbulence: 0.04, rotation: 0.06, pulse: 1.5, compression: 1.1, wave: 0.03, drift: 0.02, coreGlow: 0.5 },
  shaping: { energy: 0.95, turbulence: 0.42, rotation: 0.5, pulse: 0.7, compression: 0.92, wave: 0.75, drift: 0.25, coreGlow: 0.85 },
};

interface Particle {
  theta: number; phi: number; radius: number; speed: number;
  size: number; phase: number; depth: number; ring: number;
}

function createMinimalParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    return {
      theta, phi,
      radius: 0.75 + Math.random() * 0.25,
      speed: 0.15 + Math.random() * 0.85,
      size: 0.4 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      depth: Math.random(),
      ring: i % 3,
    };
  });
}

type Dot = { x: number; y: number; r: number; a: number; z: number; glow: boolean; trail: [number, number] | null; spark: number };
export type Frame = { dots: Dot[]; coreRadius: number };

function computeFrame(particles: Particle[], time: number, state: ThinkingOrbState, size: number): Frame {
  const config = STATE_CONFIG[state] || STATE_CONFIG.working;
  const center = size / 2;
  const baseRadius = size * 0.36;
  const breathing = 1 + Math.sin(time * config.pulse * 1.35) * 0.045 * config.energy;
  const rotation = time * config.rotation * 0.65;
  const dots: Dot[] = [];

  for (const p of particles) {
    let theta = p.theta + rotation * (0.65 + p.depth * 0.45);
    let phi = p.phi;
    const waveA = Math.sin(theta * 3 + time * (1.05 + config.energy * 0.8));
    const waveB = Math.cos(phi * 3 - time * 0.5);
    const turbulence = waveA * waveB * config.turbulence * 0.06;
    let r = p.radius * breathing * config.compression * (1 + turbulence);

    if (state === 'searching') {
      r += Math.sin(time * 1.6 + p.phase) * 0.03;
      theta += Math.sin(time * 1.2 + p.phase) * 0.02;
    } else if (state === 'solving') {
      const converge = Math.sin(time * 2.8 + p.phase);
      r += converge * 0.045;
      phi += converge * 0.02;
    } else if (state === 'listening') {
      r += Math.sin(time * 0.75 + p.phase) * 0.012;
    } else if (state === 'connecting') {
      theta += p.radius * time * 0.5;
      phi += Math.sin(time * 1.1 + p.phase) * 0.03;
    } else if (state === 'weaving') {
      theta += Math.sin(phi * 6 + time * 1.4) * 0.05;
      phi += Math.cos(theta * 4 + time * 1.1) * 0.045;
    } else if (state === 'composing') {
      r *= 0.96;
      phi += Math.sin(time * 1.4 + p.phase) * 0.015;
    } else if (state === 'shaping') {
      r *= 1 + Math.sin(theta * 2 + time * 0.9) * 0.08;
    }

    let x = Math.sin(phi) * Math.cos(theta) * r;
    let y = Math.cos(phi) * r;
    const z = Math.sin(phi) * Math.sin(theta);
    const flow = Math.sin(theta * 3 + time) * Math.sin(phi * 2 - time * 0.4);
    x += flow * config.wave * 0.025;
    y += Math.cos(theta * 2 - time * 0.8) * config.wave * 0.02;

    const perspective = 1 / (1.22 - z * 0.22);
    const sx = center + x * baseRadius * perspective;
    const sy = center + y * baseRadius * perspective;
    const depth = (z + 1) / 2;
    const pSize = p.size * (0.5 + depth * 0.85) * (size / 64);
    let alpha = (0.2 + depth * 0.8) * (0.25 + p.depth * 0.55) * config.energy;
    if (depth < 0.25) alpha *= 0.5;
    alpha = Math.min(Math.max(alpha, 0.05), 0.95);

    let trail: [number, number] | null = null;
    if (config.energy > 0.8 && pSize > 0.85 && size >= 48) {
      const len = p.speed * config.rotation * 2.2;
      trail = [sx - Math.cos(theta) * len, sy - Math.sin(theta) * len];
    }
    const sparkle = Math.sin(time * (1.5 + p.speed) + p.phase * 5);
    dots.push({
      x: sx, y: sy, r: Math.max(pSize, 0.35), a: alpha, z: depth,
      glow: size >= 40 && depth > 0.4,
      trail,
      spark: sparkle > 0.99 && depth > 0.7 && size >= 48 ? pSize * 2 : 0,
    });
  }
  // Canvas paints in array order; sort back-to-front so near dots overlap far ones naturally.
  dots.sort((a, b) => a.z - b.z);
  const corePulse = 1 + Math.sin(time * config.pulse * 1.7) * 0.1 * config.coreGlow;
  return { dots, coreRadius: size * 0.046 * corePulse };
}

const WEB = Platform.OS === 'web';
const FRAME_MS = 1000 / (WEB ? 60 : 30);

/** Batch particles by opacity rather than reconciling hundreds of SVG circles. */
const NativeParticles = React.memo(function NativeParticles({ dots, dark }: { dots: Dot[]; dark: boolean }) {
  const buckets = Array.from({ length: 32 }, () => ({ body: '', glow: '', trails: '', sparks: '', trailWidth: 0, trailsCount: 0 }));
  const n = (v: number) => v.toFixed(2);
  const circle = (d: Dot, scale = 1) => {
    const r = d.r * scale;
    return `M${n(d.x - r)},${n(d.y)}a${n(r)},${n(r)} 0 1 0 ${n(r * 2)},0a${n(r)},${n(r)} 0 1 0 ${n(-r * 2)},0Z`;
  };
  for (const d of dots) {
    const b = buckets[Math.min(31, Math.round(d.a * 31))];
    b.body += circle(d);
    if (d.glow) b.glow += circle(d, 2.6);
    if (d.trail) {
      b.trails += `M${n(d.trail[0])},${n(d.trail[1])}L${n(d.x)},${n(d.y)}`;
      b.trailWidth += Math.max(d.r * .5, .35);
      b.trailsCount++;
    }
    if (d.spark) b.sparks += `M${n(d.x - d.spark)},${n(d.y)}h${n(2 * d.spark)}M${n(d.x)},${n(d.y - d.spark)}v${n(2 * d.spark)}`;
  }
  const ink = dark ? '255,255,255' : '20,20,28';
  return <>{buckets.map((b, i) => {
    const a = i / 31;
    return <React.Fragment key={i}>
      {b.trails && <Path d={b.trails} fill="none" stroke={`rgba(${ink},${a * (dark ? .09 : .11)})`} strokeWidth={b.trailWidth / b.trailsCount} strokeLinecap="round" />}
      {b.glow && <Path d={b.glow} fill={dark ? `rgba(255,255,255,${a * .1})` : `rgba(0,0,0,${a * .055})`} />}
      {b.body && <Path d={b.body} fill={`rgba(${ink},${a})`} />}
      {b.sparks && <Path d={b.sparks} fill="none" stroke={`rgba(${ink},${a * .72})`} strokeWidth={.4} />}
    </React.Fragment>;
  })}</>;
});

export function ThinkingOrb({
  state = 'working',
  size = 64,
  speed = 1,
  dark = false,
  paused = false,
  style,
  accessibilityLabel,
}: ThinkingOrbProps) {
  const particleCount = size <= 24 ? 45 : size <= 48 ? 90 : size <= 80 ? 160 : 220;
  const particles = useMemo(() => createMinimalParticles(particleCount), [particleCount]);
  const timeRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frame, setFrame] = useState<Frame>(() => computeFrame(particles, 0, state, size));
  const [reduced, setReduced] = useState(false);
  const [focused, setFocused] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active' || AppState.currentState == null);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduced(v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { alive = false; sub.remove(); };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  const running = !paused && !reduced && focused && appActive;

  useEffect(() => {
    // Reduced motion shows the static initial pose.
    if (reduced) timeRef.current = 0;
    const canvas = canvasRef.current;
    const context = WEB ? canvas?.getContext('2d') : null;
    if (canvas && context) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size * ratio);
      canvas.height = Math.round(size * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    const paint = () => {
      const next = computeFrame(particles, timeRef.current, state, size);
      if (context) drawOrb(context, next, size, dark);
      else if (!WEB) setFrame(next);
    };
    paint();
    if (!running) return;
    let raf: number | null = null;
    let last = 0;
    let acc = 0;
    const tick = (ts: number) => {
      // First tick after (re)start counts as one 16ms step: no elapsed-time jump.
      const delta = last === 0 ? 16 : Math.min(ts - last, 100);
      last = ts;
      timeRef.current += (delta / 1000) * speed;
      acc += delta;
      if (acc + .5 >= FRAME_MS) {
        // Keep the remainder so frame intervals do not drift between 30 and 20 FPS.
        acc = Math.max(0, acc - FRAME_MS) % FRAME_MS;
        paint();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf !== null) cancelAnimationFrame(raf); };
  }, [running, reduced, particles, state, size, speed, dark]);

  const c = size / 2;
  const base = size * 0.36;
  const { dots, coreRadius } = frame;
  const bloomR = coreRadius * 4.2;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? `${state} orb`}
      style={[{ width: size, height: size, overflow: 'visible' }, style]}
    >
      {WEB ? React.createElement('canvas', {
        ref: canvasRef,
        'aria-hidden': true,
        style: { width: size, height: size, display: 'block' },
      }) : <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="halo" cx={c} cy={c} r={base * 1.55} gradientUnits="userSpaceOnUse">
            {dark ? (
              [
                <Stop key="0" offset="0" stopColor="#ffffff" stopOpacity={0.06} />,
                <Stop key="1" offset="0.35" stopColor="#ffffff" stopOpacity={0.02} />,
                <Stop key="2" offset="0.7" stopColor="#ffffff" stopOpacity={0.005} />,
                <Stop key="3" offset="1" stopColor="#000000" stopOpacity={0} />
              ]
            ) : (
              [
                <Stop key="0" offset="0" stopColor="#000000" stopOpacity={0.05} />,
                <Stop key="1" offset="0.4" stopColor="#000000" stopOpacity={0.015} />,
                <Stop key="2" offset="0.8" stopColor="#000000" stopOpacity={0.003} />,
                <Stop key="3" offset="1" stopColor="#ffffff" stopOpacity={0} />
              ]
            )}
          </RadialGradient>
          <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
            {dark ? (
              [
                <Stop key="0" offset="0" stopColor="#ffffff" stopOpacity={0.92} />,
                <Stop key="1" offset="0.18" stopColor="#ffffff" stopOpacity={0.55} />,
                <Stop key="2" offset="0.4" stopColor="#f0f0f8" stopOpacity={0.18} />,
                <Stop key="3" offset="0.7" stopColor="#dcdceb" stopOpacity={0.04} />,
                <Stop key="4" offset="1" stopColor="#000000" stopOpacity={0} />
              ]
            ) : (
              [
                <Stop key="0" offset="0" stopColor="#121218" stopOpacity={0.92} />,
                <Stop key="1" offset="0.2" stopColor="#23232d" stopOpacity={0.5} />,
                <Stop key="2" offset="0.45" stopColor="#464655" stopOpacity={0.16} />,
                <Stop key="3" offset="0.75" stopColor="#646478" stopOpacity={0.03} />,
                <Stop key="4" offset="1" stopColor="#ffffff" stopOpacity={0} />
              ]
            )}
          </RadialGradient>
          <RadialGradient id="coreShadow" cx="50%" cy="50%" r="50%">
            <Stop offset="0.5" stopColor={dark ? '#ffffff' : '#000000'} stopOpacity={dark ? 0.25 : 0.15} />
            <Stop offset="1" stopColor={dark ? '#ffffff' : '#000000'} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="hot" cx="50%" cy="50%" r="50%">
            {dark ? (
              [
                <Stop key="0" offset="0" stopColor="#ffffff" stopOpacity={0.98} />,
                <Stop key="1" offset="0.45" stopColor="#ffffff" stopOpacity={0.45} />,
                <Stop key="2" offset="1" stopColor="#ffffff" stopOpacity={0} />
              ]
            ) : (
              [
                <Stop key="0" offset="0" stopColor="#0a0a0f" stopOpacity={0.98} />,
                <Stop key="1" offset="0.45" stopColor="#1e1e28" stopOpacity={0.45} />,
                <Stop key="2" offset="1" stopColor="#000000" stopOpacity={0} />
              ]
            )}
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width={size} height={size} fill="url(#halo)" />

        <NativeParticles dots={dots} dark={dark} />

        <Circle cx={c} cy={c} r={bloomR + size * 0.14} fill="url(#coreShadow)" />
        <Circle cx={c} cy={c} r={bloomR} fill="url(#bloom)" />
        <Circle cx={c} cy={c} r={coreRadius * 0.95} fill="url(#hot)" />
      </Svg>}
    </View>
  );
}

export default ThinkingOrb;
