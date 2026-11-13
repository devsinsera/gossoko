
import { useMemo } from 'react';
import type { Venue } from '@/lib/types';
import { COLORS } from '@/lib/theme';
import { VenueCard } from '@/components/VenueCard';
import { VenueDistance } from '@/components/VenueDistance';
import { useCoords } from '@/components/DistanceProvider';
import { haversineKm } from '@/lib/geo';
import { Link } from '@/lib/nav';
import { displayScore } from '@/lib/ranking';

const NEAR_RADIUS_KM = 10;

/**
 * The two lists on the Nearby page. With the phone's location they are
 * "Closest First" and "Highest Rated Nearby" (within 10 km). Without it there is
 * no honest way to say what is close, so it lists every venue, best-reviewed first.
 */
export function NearbyList({ venues }: { venues: Venue[] }) {
  const coords = useCoords();

  const { sortedByDistance, nearAndTopRated } = useMemo(() => {
    // Compute each venue's distance once; guard against non-finite lat/lng so a
    // bad coordinate can't poison the sort with NaN comparisons.
    if (!coords) {
      const byReviews = [...venues].sort((a, b) => b.overall * Math.min(b.review_count, 10) - a.overall * Math.min(a.review_count, 10) || a.name.localeCompare(b.name));
      return { sortedByDistance: byReviews, nearAndTopRated: [] as Venue[] };
    }
    const distances = new Map(
      venues.map((v) => [v.id, Number.isFinite(v.lat) && Number.isFinite(v.lng) ? haversineKm(coords.lat, coords.lng, v.lat, v.lng) : 9999] as const),
    );
    const distanceOf = (v: Venue) => distances.get(v.id) ?? 9999;

    const sorted = [...venues].sort((a, b) => distanceOf(a) - distanceOf(b));
    const topNear = sorted
      .filter((v) => distanceOf(v) < NEAR_RADIUS_KM && v.review_count > 0)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 4);

    return { sortedByDistance: sorted, nearAndTopRated: topNear };
  }, [venues, coords]);

  return (
    <>
      <section className="section">
        <div className="section-title">
          <h2>{coords ? 'Closest First' : 'All Venues'}</h2>
          <span className="mono-chip">{sortedByDistance.length} results</span>
        </div>
        <div className="row-list">
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
                <VenueDistance lat={v.lat} lng={v.lng} />
              </div>
              <Link href={`/venue/${v.slug}`} style={{ minWidth: 0, textDecoration: 'none' }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.name}
                </div>
                <div style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {v.suburb}{v.tagline ? ` · ${v.tagline}` : ''}
                </div>
              </Link>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                color: COLORS.orange,
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 700,
              }}>
                {displayScore(v) ? `★ ${displayScore(v)}` : 'NEW'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {nearAndTopRated.length > 0 && (
      <section className="section">
        <div className="section-title">
          <h2>Highest Rated Nearby</h2>
        </div>
        <div className="card-list">
          {nearAndTopRated.map((v) => (
            <VenueCard key={v.id} venue={v} />
          ))}
        </div>
      </section>
      )}
    </>
  );
}
