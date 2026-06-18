'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Venue } from '@/lib/seed/types';
import { COLORS } from '@/lib/theme';
import { MapPinIcon, ChevronRightIcon, CompassIcon } from './icons';
import { VenueDistance } from './VenueDistance';

// Fake map. Real one comes later. For the shell we project the venue
// lat/lng into the SVG viewport so the dots cluster the way Brisbane does,
// without pulling in a map lib or tile provider.

const PADDING = 0.05;

export function MapShell({ venues }: { venues: Venue[] }) {
  const [selected, setSelected] = useState<string | null>(venues[0]?.id ?? null);

  const { project } = useMemo(() => {
    const lats = venues.map((v) => v.lat);
    const lngs = venues.map((v) => v.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;
    return {
      project: (lat: number, lng: number) => ({
        x: PADDING + ((lng - minLng) / lngRange) * (1 - PADDING * 2),
        // invert y because lat increases northwards
        y: PADDING + (1 - (lat - minLat) / latRange) * (1 - PADDING * 2),
      }),
    };
  }, [venues]);

  const sel = venues.find((v) => v.id === selected) ?? venues[0];

  return (
    <div style={{
      position: 'relative',
      borderRadius: 12,
      overflow: 'hidden',
      border: `1px solid ${COLORS.border}`,
      background: COLORS.surface,
    }}>
      {/* Faux-map canvas */}
      <div style={{
        position: 'relative',
        height: 380,
        background:
          `linear-gradient(180deg, #0d0c0a 0%, #0a0908 100%)`,
      }}>
        {/* Subtle grid — implies streets */}
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M10 0H0V10" stroke={COLORS.border} strokeWidth="0.15" fill="none" />
            </pattern>
            <pattern id="majorGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" stroke={COLORS.borderStrong} strokeWidth="0.25" fill="none" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
          <rect width="100" height="100" fill="url(#majorGrid)" />
          {/* fake river ribbon — gestural Brisbane River */}
          <path
            d="M -5 60 Q 25 55 40 65 T 75 55 T 110 65"
            stroke={COLORS.orangeDim}
            strokeWidth="3"
            fill="none"
            opacity="0.55"
          />
          <path
            d="M -5 60 Q 25 55 40 65 T 75 55 T 110 65"
            stroke={COLORS.orange}
            strokeWidth="0.5"
            fill="none"
            opacity="0.3"
          />
        </svg>

        {/* "You are here" marker (centre-ish) */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: COLORS.hiVisGreen,
            border: `2px solid #0a0908`,
            boxShadow: `0 0 0 6px rgba(168, 224, 0, 0.18)`,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            letterSpacing: '0.16em',
            color: COLORS.hiVisGreen,
            background: 'rgba(10, 9, 8, 0.7)',
            padding: '2px 6px',
            borderRadius: 3,
            textTransform: 'uppercase',
          }}>
            You
          </span>
        </div>

        {/* Venue pins */}
        {venues.map((v) => {
          const { x, y } = project(v.lat, v.lng);
          const isSelected = v.id === sel?.id;
          return (
            <button
              key={v.id}
              onClick={() => setSelected(v.id)}
              aria-label={`Show ${v.name}`}
              style={{
                position: 'absolute',
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                transform: 'translate(-50%, -100%)',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: isSelected ? COLORS.orange : COLORS.orangeBright,
                filter: isSelected ? `drop-shadow(0 0 6px ${COLORS.orange})` : undefined,
                zIndex: isSelected ? 2 : 1,
              }}
            >
              <MapPinIcon size={isSelected ? 30 : 22} />
            </button>
          );
        })}

        {/* Compass / scale indicator (top-right) */}
        <div style={{
          position: 'absolute',
          top: 10, right: 10,
          padding: '4px 8px',
          background: 'rgba(10, 9, 8, 0.7)',
          border: `1px solid ${COLORS.border}`,
          borderRadius: 4,
          color: COLORS.textSecondary,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <CompassIcon size={12} />
          BRISBANE
        </div>
      </div>

      {/* Selected venue panel */}
      {sel && (
        <Link
          href={`/venue/${sel.slug}`}
          style={{
            display: 'block',
            padding: '14px 14px',
            borderTop: `1px solid ${COLORS.border}`,
            background: COLORS.bgElev,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${sel.hero_color}, #0a0908)`,
              border: `1px solid ${sel.hero_accent}`,
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: sel.hero_accent,
            }}>
              <MapPinIcon size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{
                margin: 0,
                color: COLORS.text,
                fontSize: 15,
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {sel.name}
              </h4>
              <p style={{
                margin: '2px 0 0',
                color: COLORS.textSecondary,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                {sel.suburb} · <VenueDistance lat={sel.lat} lng={sel.lng} fallbackKm={sel.distance_km} /> · ★ {sel.overall.toFixed(1)}
              </p>
            </div>
            <ChevronRightIcon size={20} />
          </div>
        </Link>
      )}
    </div>
  );
}
