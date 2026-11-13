// Design tokens for the Gossoko app shell — taken straight from the logo:
// near-black ground, glossy orange pin with a cream rim, coffee crema, chunky
// cream letters with a burnt-orange extrude.

export const COLORS = {
  bg: '#0a0908',
  bgElev: '#100c09',
  surface: '#17110d',
  surfaceAlt: '#1f1711',
  surfaceHi: '#2a1e15',
  border: '#33251a',
  borderStrong: '#4a3524',

  text: '#fff3e4',
  textSecondary: '#cdb79e',
  textMuted: '#8c7763',

  orange: '#FF7A00',
  orangeBright: '#FF8A1A',
  orangeHot: '#E8590C',
  orangeDim: 'rgba(255, 122, 0, 0.18)',
  orangeFaint: 'rgba(255, 122, 0, 0.09)',

  // Cream: the pin's rim and the letter faces. Extrude: the wordmark's 3D edge.
  cream: '#ffe9cf',
  extrude: '#a8490c',
  // Coffee: the pin's crema. Pairs with orange for depth; never body text on orange.
  coffee: '#8e4a1c',
  coffeeDeep: '#2a1408',

  // Status colours, warmed to sit with the palette.
  green: '#9ccc65',
  gold: '#ffb547',
  red: '#E5484D',
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
  /** Chunky display face, the web stand-in for the wordmark's Arial Black. */
  display: '"Archivo Black", "Arial Black", system-ui, sans-serif',
  /** Small caps labels, chips, stats: rounded system face. */
  label: 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, Roboto, sans-serif',
} as const;

/** Primary fill: the pin body, orange shading down to burnt orange. Dark coffee text sits on it. */
export const BRAND_GRADIENT =
  'linear-gradient(180deg, #FF8A1A 0%, #FF7A00 42%, #C9590C 100%)';

/** Text that sits on the orange fill. */
export const ON_ORANGE = '#2a1408';

/** Thin brand ribbon (replaces the old hazard stripes): cream rim, orange, burnt orange. */
export const BRAND_RIBBON =
  'linear-gradient(90deg, #ffe9cf 0%, #FF8A1A 18%, #FF7A00 50%, #a8490c 100%)';

export const BOTTOM_NAV_HEIGHT = 64;
export const APP_MAX_WIDTH = 480;
