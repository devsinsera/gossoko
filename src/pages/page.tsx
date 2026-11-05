import { VenueCard } from '@/components/VenueCard';
import { FilterChips } from '@/components/FilterChips';
import { getAllVenues } from '@/lib/queries/venues';
import { getRecentReviews } from '@/lib/queries/reviews';
import { useLoad } from '@/lib/useLoad';
import FeedLoading from './loading';
import type { Venue } from '@/lib/types';
import { COLORS } from '@/lib/theme';
import { StarIcon, FlameIcon, MapPinIcon } from '@/components/icons';
import { VenueDistance } from '@/components/VenueDistance';
import { Link } from '@/lib/nav';

export default function FeedPage() {
  const { data, loading } = useLoad(async () => {
    const [allVenues, recentReviews] = await Promise.all([getAllVenues(), getRecentReviews(4)]);
    return { allVenues, recentReviews };
  }, []);
  if (loading && !data) return <FeedLoading />;
  const allVenues = data?.allVenues ?? [];
  const recentReviews = data?.recentReviews ?? [];
  // Top-rated first for the hero; the other slices apply different orderings.
  const topRated = [...allVenues].sort((a, b) => b.overall - a.overall);
  const featured = topRated[0];
  const open = allVenues.filter((v) => v.open_now).slice(0, 6);
  const trending = allVenues.filter((v) => v.trending);
  const nearMe = [...allVenues].sort((a, b) => a.distance_km - b.distance_km).slice(0, 6);

  return (
    <>
      {/* Top bar */}
      <header className="top-bar">
        <div>
          <h1 className="wordmark">
            <span className="wordmark__brand">GOSSOKO</span>
            <span className="wordmark__dot">●</span>
          </h1>
          <p className="top-bar__sub">Find the best tradie feed near the site.</p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 999,
          color: COLORS.hiVisGreen,
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          <MapPinIcon size={12} /> Brisbane
        </div>
      </header>

      {/* Filter chips */}
      <div style={{ marginTop: 6 }}>
        <FilterChips />
      </div>

      {/* Featured hero card */}
      {featured && (
        <section className="section">
          <FeaturedVenue venue={featured} />
        </section>
      )}

      {/* Open now */}
      <section className="section">
        <div className="section-title">
          <h2>
            <span className="pulse-dot" style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Open Now
          </h2>
          <Link href="/nearby">View map</Link>
        </div>
        <div className="h-scroll">
          {open.map((v) => (
            <VenueCard key={v.id} venue={v} variant="compact" />
          ))}
        </div>
      </section>

      {/* Trending */}
      <section className="section">
        <div className="section-title">
          <h2>
            <FlameIcon size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Trending This Week
          </h2>
          <Link href="/rankings">See rankings</Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {trending.map((v) => (
            <VenueCard key={v.id} venue={v} />
          ))}
        </div>
      </section>

      {/* Near me */}
      <section className="section">
        <div className="section-title">
          <h2>Closest to You</h2>
          <Link href="/nearby">All nearby</Link>
        </div>
        <div className="h-scroll">
          {nearMe.map((v) => (
            <VenueCard key={v.id} venue={v} variant="compact" />
          ))}
        </div>
      </section>

      {/* Recent reviews */}
      <section className="section">
        <div className="section-title">
          <h2>Latest from the Crew</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recentReviews.length === 0 && (
            <p style={{ margin: 0, color: COLORS.textMuted, fontSize: 13 }}>
              No reviews yet — be the first to rate a feed.
            </p>
          )}
          {recentReviews.map((r) => (
            <Link
              key={r.id}
              href={`/venue/${r.venue_slug}`}
              style={{
                display: 'block',
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: COLORS.orange, color: '#0a0908',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 12, letterSpacing: '0.04em',
                }}>
                  {r.user.initials}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>
                    @{r.user.username}
                    <span style={{ color: COLORS.textMuted, fontWeight: 400 }}> · {r.user.trade.toLowerCase()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    on {r.venue_name}
                  </div>
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  color: COLORS.orange, fontWeight: 700, fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                }}>
                  <StarIcon size={12} filled /> {r.overall.toFixed(1)}
                </span>
              </div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5, color: COLORS.text }}>
                {r.title}
              </p>
              <p style={{
                margin: '4px 0 0',
                color: COLORS.textSecondary,
                fontSize: 13,
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {r.body}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <div className="hazard-strip" style={{ marginTop: 28 }} />
    </>
  );
}

function FeaturedVenue({ venue }: { venue: Venue }) {
  return (
    <Link
      href={`/venue/${venue.slug}`}
      style={{
        display: 'block',
        position: 'relative',
        borderRadius: 14,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${venue.hero_color} 0%, #0a0908 100%)`,
        border: `1px solid ${venue.hero_accent}`,
        boxShadow: `0 0 0 4px rgba(255, 122, 0, 0.08)`,
      }}
    >
      {/* Hazard top */}
      <div aria-hidden style={{
        height: 6,
        background: `repeating-linear-gradient(135deg, ${venue.hero_accent} 0 12px, #111 12px 24px)`,
      }} />
      <div style={{ padding: '18px 18px 16px' }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          background: 'rgba(10, 9, 8, 0.7)',
          color: venue.hero_accent,
          border: `1px solid ${venue.hero_accent}`,
          borderRadius: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}>
          ★ Top Rated · #1
        </span>
        <h3 style={{
          margin: '10px 0 6px',
          fontSize: '1.55rem',
          fontWeight: 800,
          letterSpacing: '0.005em',
          color: COLORS.text,
          textTransform: 'uppercase',
          lineHeight: 1.05,
        }}>
          {venue.name}
        </h3>
        <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 14, lineHeight: 1.5 }}>
          {venue.tagline}
        </p>
        <div style={{
          marginTop: 12,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <Stat label="Overall" value={venue.overall.toFixed(1)} accent={COLORS.orange} />
          <Stat label="Reviews" value={String(venue.review_count)} />
          <Stat label="Distance" value={<VenueDistance lat={venue.lat} lng={venue.lng} fallbackKm={venue.distance_km} />} />
          <Stat label="Opens" value={venue.opens_at} />
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9.5,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: COLORS.textMuted,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 18,
        fontWeight: 700,
        color: accent ?? COLORS.text,
        marginTop: 2,
      }}>
        {value}
      </div>
    </div>
  );
}
