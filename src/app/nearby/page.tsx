import { VENUES } from '@/lib/seed/venues';
import { MapShell } from '@/components/MapShell';
import { VenueCard } from '@/components/VenueCard';
import { FilterChips } from '@/components/FilterChips';
import { COLORS } from '@/lib/theme';

export default function NearbyPage() {
  const sortedByDistance = [...VENUES].sort((a, b) => a.distance_km - b.distance_km);

  return (
    <>
      <header className="top-bar">
        <div>
          <h1>NEARBY</h1>
          <p className="top-bar__sub">{VENUES.length} venues · within 40km</p>
        </div>
      </header>

      <FilterChips defaultSelected="open_now" />

      <section className="section">
        <MapShell venues={VENUES} />
      </section>

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
                gridTemplateColumns: '44px 1fr auto',
                gap: 12,
                alignItems: 'center',
                padding: '12px 14px',
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 8,
                background: `linear-gradient(135deg, ${v.hero_color}, #0a0908)`,
                border: `1px solid ${v.hero_accent}`,
                color: v.hero_accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}>
                {v.distance_km}km
              </div>
              <a href={`/venue/${v.id}`} style={{ minWidth: 0 }}>
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
          {sortedByDistance
            .filter((v) => v.distance_km < 10)
            .sort((a, b) => b.overall - a.overall)
            .slice(0, 4)
            .map((v) => (
              <VenueCard key={v.id} venue={v} />
            ))}
        </div>
      </section>

      <div className="hazard-strip" style={{ marginTop: 28 }} />
    </>
  );
}
