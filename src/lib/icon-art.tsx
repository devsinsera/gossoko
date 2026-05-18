// Shared brand mark used by all icon sizes (favicon, apple-icon, manifest 192/512).
// Rendered via next/og ImageResponse so we don't ship raster source files —
// the icon scales cleanly because everything is layout-relative.
// Industrial dark base + safety-orange "G" + hazard-tape corner stripe.

import type { CSSProperties } from 'react';

const ORANGE = '#FF7A00';
const BG = '#0a0908';

export function iconStyle(size: number): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: BG,
    color: ORANGE,
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontWeight: 900,
    fontSize: size * 0.62,
    letterSpacing: '-0.03em',
    position: 'relative',
    overflow: 'hidden',
  };
}

export function IconArt({ size }: { size: number }) {
  return (
    <div style={iconStyle(size)}>
      {/* Hazard tape — top-right corner accent. Pure CSS gradient so it
          scales identically at every size. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: size * 0.4,
          height: size * 0.1,
          background: `repeating-linear-gradient(135deg, ${ORANGE} 0 ${size * 0.05}px, #111 ${size * 0.05}px ${size * 0.1}px)`,
        }}
      />
      {/* Hazard tape — bottom-left for visual balance */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: size * 0.4,
          height: size * 0.1,
          background: `repeating-linear-gradient(135deg, ${ORANGE} 0 ${size * 0.05}px, #111 ${size * 0.05}px ${size * 0.1}px)`,
        }}
      />
      {/* Inner border — gives it the badge feel */}
      <div
        style={{
          position: 'absolute',
          inset: size * 0.08,
          border: `${Math.max(2, size * 0.025)}px solid ${ORANGE}`,
          borderRadius: size * 0.1,
        }}
      />
      {/* The G */}
      <span style={{ lineHeight: 1, marginTop: -size * 0.02 }}>G</span>
    </div>
  );
}

// Constants exported for layout meta + manifest
export const BRAND = {
  orange: ORANGE,
  bg: BG,
  name: 'Gossoko',
  short: 'Gossoko',
  description: 'Find the best tradie feed near the site.',
} as const;
