// Design tokens for the Gossoko app shell.
// Dark, industrial, hi-vis safety-orange — built for one-handed use under
// site-light conditions (bright sun, dusty screens, gloved fingertips).

export const COLORS = {
  bg: '#0a0908',
  bgElev: '#0f0d0b',
  surface: '#15110d',
  surfaceAlt: '#1a1612',
  surfaceHi: '#221c17',
  border: '#2a2520',
  borderStrong: '#3a3530',

  text: '#f5f1ec',
  textSecondary: '#a89e92',
  textMuted: '#6b645c',

  orange: '#FF7A00',
  orangeBright: '#FF9533',
  orangeHot: '#FF5500',
  orangeDim: 'rgba(255, 122, 0, 0.18)',
  orangeFaint: 'rgba(255, 122, 0, 0.08)',

  hiVisGreen: '#A8E000',
  hiVisYellow: '#F2C200',
  red: '#E63946',
} as const;

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const FONTS = {
  body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  display: '"Helvetica Neue", system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
} as const;

export const HAZARD_STRIPES =
  `repeating-linear-gradient(135deg, ${COLORS.orange} 0 10px, #111 10px 20px)`;

export const BOTTOM_NAV_HEIGHT = 64;
export const APP_MAX_WIDTH = 480;
