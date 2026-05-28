'use client';

import { useMemo } from 'react';
import type { Venue } from '@/lib/seed/types';
import { COLORS } from '@/lib/theme';
import { VenueCard } from '@/components/VenueCard';
import { VenueDistance } from '@/components/VenueDistance';
import { useCoords } from '@/components/DistanceProvider';
import { haversineKm } from '@/lib/geo';

// The "within 10km" cut-off the static page used. When real coords are known
// we apply it against the live haversine distance instead of the seed column.
const NEAR_RADIUS_KM = 10;

/**
 * Renders the two distance-dependent sections of the Nearby page:
 * "Closest First" and "Highest Rated Nearby". When device coords are available
 * it sorts and filters by REAL distance; otherwise it falls back to the static
 * `distance_km` ordering/filter (identical to the original server behaviour).
 */
export function NearbyList({ venues }: { venues: Venue[] }) {
  const coords = useCoords();

  const { sortedByDistance, nearAndTopRated } = useMemo(() => {
    // Compute each venue's distance once; guard against non-finite lat/lng so a
    // bad coordinate can't poison the sort with NaN comparisons.
    const distances = new Map(
      venues.map((v) => {
        const live =
          coords && Number.isFinite(v.lat) && Number.isFinite(v.lng)
            ? haversineKm(coords.lat, coords.lng, v.lat, v.lng)
            : v.distance_km;
        return [v.id, live] as const;
      }),
    );
    const distanceOf = (v: Venue) => distances.get(v.id) ?? v.distance_km;

    const sorted = [...venues].sort((a, b) => distanceOf(a) - distanceOf(b));
    const topNear = sorted
      .filter((v) => distanceOf(v) < NEAR_RADIUS_KM)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 4);

    return { sortedByDistance: sorted, nearAndTopRated: topNear };
  }, [venues, coords]);

  return (
    <>
      <section className="section">
        <div className="section-title">
          <h2>Closest First</h2>
          <span className="mono-chip">{sortedByDistance.length} results</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sortedByDistance.map((v) => (
            <div
              key={v.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(44px, auto) 1fr auto',
                gap: 12,
                alignItems: 'center',
                padding: '12px 14px',
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
              }}
            >
              <div style={{
                minWidth: 44, height: 44, borderRadius: 8, padding: '0 6px',
                background: `linear-gradient(135deg, ${v.hero_color}, #0a0908)`,
                border: `1px solid ${v.hero_accent}`,
                color: v.hero_accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}>
                <VenueDistance lat={v.lat} lng={v.lng} fallbackKm={v.distance_km} />
              </div>
              <a href={`/venue/${v.slug}`} style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.name}
                </div>
                <div style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {v.suburb} · {v.tagline}
                </div>
              </a>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                color: COLORS.orange,
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 700,
              }}>
                ★ {v.overall.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Highest Rated Nearby</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {nearAndTopRated.map((v) => (
            <VenueCard key={v.id} venue={v} />
          ))}
        </div>
      </section>
    </>
  );
}
