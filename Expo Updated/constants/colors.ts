/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const light = {
    // Legacy aliases (kept for backward compatibility)
    text: '#0a0a0a',
    tint: '#2f95dc',

    // Core surfaces
    background: '#ffffff',
    foreground: '#0a0a0a',

    // Cards / elevated surfaces
    card: '#f9f9f9',
    cardForeground: '#0a0a0a',

    // Primary action color (buttons, links, active states)
    primary: '#2f95dc',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#f0f0f0',
    secondaryForeground: '#1a1a1a',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#f0f0f0',
    mutedForeground: '#737373',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#f0f0f0',
    accentForeground: '#1a1a1a',

    // Destructive actions (delete, error states)
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#e5e5e5',
    input: '#e5e5e5',

    // Wallet semantic tokens (soft-blue balance panel + light sculpted surfaces)
    walletCanvas: '#f0f0f1',
    walletCardTop: '#fefefe',
    walletCardBottom: '#f6f6f7',
    walletBlue: ['#e6edff', '#b4c8f7', '#6f98ee', '#4f80e8', '#4a79e3'] as const,
    walletBlueShadow: '#3b64d2',
    walletOnBlue: '#fdfdff',
    walletOnBlueMuted: 'rgba(255,255,255,0.85)',
    walletGlass: 'rgba(255,255,255,0.2)',
    walletGlassBorder: 'rgba(255,255,255,0.35)',
    walletSurfaceTop: '#fefefe',
    walletSurfaceBottom: '#f1f1f3',
    walletInset: '#f4f4f5',
    walletInk: '#171717',
    walletOnInk: '#fdfdff',
    dashboardBalance: '#18181B',
    walletQRBackground: '#ffffff',
    walletQRInk: '#171717',
    walletContactInk: '#262626',
    walletInkSoft: '#262626',
    walletMuted: '#a3a3a3',
    walletSubtle: '#737373',
    walletField: '#f5f5f5',
    walletFieldPressed: '#e5e5e5',
    walletDisabled: '#e5e5e5',
    walletDisabledInk: '#a3a3a3',
    walletPositive: '#059669',
    walletPositiveSoft: '#ecfdf5',
    walletError: '#dc2626',
    walletDarkTop: '#2b2b2e',
    walletDarkBottom: '#0b0b0c',
    walletScrim: 'rgba(10,12,20,0.35)',
    walletSheet: '#fefefe',
    walletShadow: '#14203c',
    walletBall: ['#d9c4f6', '#b98be8', '#f0a7c8'] as const,
    walletDemo: '#fff4d6',
    walletDemoInk: '#8a5a00',
    walletContactZane: '#a6e3b0',
    walletContactMaya: '#d3c8f7',
    walletContactRemy: '#f7b5bc',
    walletContactArjun: '#ecc9a6',
    walletContactNova: '#aedcf9',
    walletContactNovaInk: '#0d4b73',
    swapBitcoin: '#F7931A',
    swapEthereum: '#1B1F4D',
    swapEthereumInk: '#B8C2FF',
    swapHype: '#072723',
    swapHypeInk: '#97FCE4',
    swapZcash: '#F4B728',
    swapQuant: '#000000',

    // Mining (demo) tokens
    miningCanvas: '#fbfcfb',
    miningCellEmpty: '#f1f3f2',
    miningCyan: '#a9e6f5',
    miningCyanDeep: '#2fa8c9',
    miningLime: '#c9ef9f',
    miningLimeDeep: '#6fb82f',
    miningRate: '#2f7fd8',
    miningRateSoft: '#eaf3fd',
    miningPage: '#f6f6f7',
    miningLabel: '#312f2f',
    miningPill: '#fefefe',
    miningHairline: 'rgba(0,0,0,0.12)',
    miningNotice: '#eef2fb',
    miningNoticeInk: '#3b4f7a',

    // Glass dock (60% white pane, lit rim, soft cast shadow)
    dockPane: 'rgba(255,255,255,0.6)',
    dockInk: '#171717',
    dockOnInk: '#fdfdff',
    dockRimHi: 'rgba(255,255,255,0.95)',
    dockRimLo: 'rgba(255,255,255,0.18)',
    dockRimFar: 'rgba(255,255,255,0.55)',
    dockSpec: 'rgba(255,255,255,0.9)',
    dockShadow: '#14203c',
};

type Palette = {
  [K in keyof typeof light]: typeof light[K] extends readonly string[]
    ? readonly [string, string, ...string[]]
    : string;
};

const dark: Palette = {
  ...light,
  text: '#f4f4f5',
  tint: '#93b4ff',
  background: '#111113',
  foreground: '#f4f4f5',
  card: '#202023',
  cardForeground: '#f4f4f5',
  primary: '#93b4ff',
  primaryForeground: '#111827',
  secondary: '#27272b',
  secondaryForeground: '#e4e4e7',
  muted: '#27272b',
  mutedForeground: '#a1a1aa',
  accent: '#303037',
  accentForeground: '#f4f4f5',
  destructive: '#f87171',
  destructiveForeground: '#111113',
  border: '#36363d',
  input: '#36363d',
  walletCanvas: '#0c0c0e',
  walletCardTop: '#111113',
  walletCardBottom: '#171719',
  walletBlue: ['#244070', '#234884', '#2456a5', '#2864c7', '#326ed1'],
  walletBlueShadow: '#000000',
  walletSurfaceTop: '#242428',
  walletSurfaceBottom: '#1d1d21',
  walletInset: '#1c1c20',
  walletInk: '#f4f4f5',
  walletOnInk: '#18181b',
  dashboardBalance: '#f4f4f5',
  walletInkSoft: '#e4e4e7',
  walletMuted: '#92929c',
  walletSubtle: '#a1a1aa',
  walletField: '#26262b',
  walletFieldPressed: '#36363e',
  walletDisabled: '#35353d',
  walletDisabledInk: '#92929c',
  walletPositive: '#34d399',
  walletPositiveSoft: '#12382c',
  walletError: '#f87171',
  walletDarkTop: '#34343a',
  walletDarkBottom: '#242428',
  walletScrim: 'rgba(0,0,0,0.72)',
  walletSheet: '#1b1b1f',
  walletShadow: '#000000',
  walletDemo: '#392f18',
  walletDemoInk: '#f1cf83',
  miningCanvas: '#111514',
  miningCellEmpty: '#262d2a',
  miningCyan: '#194350',
  miningCyanDeep: '#67d3ee',
  miningLime: '#293c20',
  miningLimeDeep: '#b3df86',
  miningRate: '#93b4ff',
  miningRateSoft: '#1c2b46',
  miningPage: '#171719',
  miningLabel: '#d4d4d8',
  miningPill: '#242428',
  miningHairline: 'rgba(255,255,255,0.16)',
  miningNotice: '#202c42',
  miningNoticeInk: '#b7c8ef',
  dockPane: 'rgba(30,30,34,0.82)',
  dockInk: '#f4f4f5',
  dockOnInk: '#18181b',
  dockRimHi: 'rgba(255,255,255,0.2)',
  dockRimLo: 'rgba(255,255,255,0.04)',
  dockRimFar: 'rgba(255,255,255,0.1)',
  dockSpec: 'rgba(255,255,255,0.12)',
  dockShadow: '#000000',
};

const colors = {
  light,
  dark,

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
