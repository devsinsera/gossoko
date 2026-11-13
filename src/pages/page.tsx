import { useState } from 'react';
import wordmarkUrl from '@/assets/brand/gossoko-wordmark.svg';
import pinUrl from '@/assets/brand/gossoko-pin.svg';
import { VenueCard } from '@/components/VenueCard';
import { DealCard } from '@/components/DealCard';
import { useCoords } from '@/components/DistanceProvider';
import { useAuth } from '@/lib/auth';
import { getLiveDeals, getMyActiveCodes } from '@/lib/queries/business';
import { applyFilter, type FilterId } from '@/lib/filters';
import { haversineKm } from '@/lib/geo';
import { SponsorSlot } from '@/components/SponsorSlot';
import { FilterChips } from '@/components/FilterChips';
import { getAllVenues } from '@/lib/queries/venues';
import { getRecentReviews } from '@/lib/queries/reviews';
import { useLoad } from '@/lib/useLoad';
import FeedLoading from './loading';
import type { Venue } from '@/lib/types';
import { COLORS, BRAND_GRADIENT } from '@/lib/theme';
import { StarIcon, FlameIcon, MapPinIcon } from '@/components/icons';
import { VenueDistance } from '@/components/VenueDistance';
import { Link } from '@/lib/nav';
import { displayScore, rankVenues } from '@/lib/ranking';

export default function FeedPage() {
  const { user } = useAuth();
  const coords = useCoords();
  const [filter, setFilter] = useState<FilterId>('all');
  const { data, loading } = useLoad(async () => {
    const [allVenues, recentReviews, deals, codes] = await Promise.all([
      getAllVenues(), getRecentReviews(4), getLiveDeals(),
      user ? getMyActiveCodes(user.id) : Promise.resolve(new Map()),
    ]);
    return { allVenues, recentReviews, deals, codes };
  }, [user?.id]);
  if (loading && !data) return <FeedLoading />;
  const allVenues = data?.allVenues ?? [];
  const recentReviews = data?.recentReviews ?? [];
  const deals = (data?.deals ?? []).slice(0, 3);
  // The hero is the #1 ranked venue; no hero until something has enough reviews.
  const featured = filter === 'all' ? rankVenues(allVenues)[0] : undefined;
  const shown = applyFilter(allVenues, filter);
  const open = shown.filter((v) => v.open_now).slice(0, 6);
  const trending = shown.filter((v) => v.trending);
  // "Closest to you" only means something once the phone has said where it is.
  const nearMe = coords
    ? [...shown].sort((a, b) => haversineKm(coords.lat, coords.lng, a.lat, a.lng) - haversineKm(coords.lat, coords.lng, b.lat, b.lng)).slice(0, 6)
    : [];

  return (
    <>
      {/* Top bar */}
      <header className="top-bar">
        <div>
          <h1 className="wordmark">
            <img src={wordmarkUrl} alt="Gossoko" data-brand-target="header" className="wordmark__img" />
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
          color: COLORS.cream,
          fontFamily: 'var(--font-label)',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}>
          <MapPinIcon size={13} style={{ color: COLORS.orange }} /> Brisbane
        </div>
      </header>

      {/* Filter chips */}
      <div style={{ marginTop: 6 }}>
        <FilterChips onChange={setFilter} />
      </div>

      {/* Featured hero card */}
      {featured && (
        <section className="section">
          <FeaturedVenue venue={featured} />
        </section>
      )}

      {filter === 'all' && <SponsorSlot />}

      {/* Deals on now */}
      {filter === 'all' && deals.length > 0 && (
        <section className="section">
          <div className="section-title">
            <h2>Deals On Now</h2>
            <Link href="/deals">All deals</Link>
          </div>
          <div className="card-list">
            {deals.map((d) => <DealCard key={d.id} deal={d} code={data?.codes.get(d.id)} signedIn={!!user} showVenue />)}
          </div>
        </section>
      )}

      {filter !== 'all' && shown.length === 0 && (
        <section className="section">
          <p style={{ color: COLORS.textSecondary, lineHeight: 1.5 }}>Nothing matches that filter right now — try another, or pick All.</p>
        </section>
      )}

      {/* Open now */}
      {open.length > 0 && (
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

      )}

      {/* Trending */}
      {trending.length > 0 && (
      <section className="section">
        <div className="section-title">
          <h2>
            <FlameIcon size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Trending This Week
          </h2>
          <Link href="/rankings">See rankings</Link>
        </div>
        <div className="card-list">
          {trending.map((v) => (
            <VenueCard key={v.id} venue={v} />
          ))}
        </div>
      </section>

      )}

      {/* Near me */}
      {nearMe.length > 0 && (
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

      )}

      {/* Recent reviews */}
      <section className="section">
        <div className="section-title">
          <h2>Latest from the Crew</h2>
        </div>
        <div className="card-list">
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
                  background: BRAND_GRADIENT, color: '#0a0908',
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
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: 'var(--font-label)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    on {r.venue_name}
                  </div>
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  color: COLORS.orange, fontWeight: 700, fontSize: 13,
                  fontFamily: 'var(--font-label)',
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

      <div className="brand-rule" style={{ marginTop: 28 }} />
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
        borderRadius: 22,
        overflow: 'hidden',
        // The pin itself: orange body, cream rim, crema inside.
        background: 'radial-gradient(110% 120% at 100% 0%, rgba(255, 138, 26, 0.38) 0%, rgba(142, 74, 28, 0.45) 35%, rgba(42, 20, 8, 0.85) 75%, #140d08 100%)',
        border: `2px solid ${COLORS.cream}`,
        boxShadow: '0 5px 0 #7a3210, var(--card-glow)',
      }}
    >
      <img
        src={pinUrl}
        alt=""
        aria-hidden
        draggable={false}
        style={{ position: 'absolute', right: -14, top: -10, height: 150, opacity: 0.9, transform: 'rotate(8deg)', pointerEvents: 'none' }}
      />
      <div style={{ position: 'relative', padding: '18px 18px 16px' }}>
        <span className="badge badge--deal">
          <StarIcon size={12} filled /> Top rated · #1
        </span>
        <h3 style={{
          margin: '12px 96px 8px 0',
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: '1.6rem',
          letterSpacing: '0.005em',
          color: COLORS.text,
          textTransform: 'uppercase',
          lineHeight: 1.05,
          textShadow: 'var(--extrude-text)',
        }}>
          {venue.name}
        </h3>
        <p style={{ margin: '0 80px 0 0', color: COLORS.textSecondary, fontSize: 14, lineHeight: 1.5 }}>
          {venue.tagline}
        </p>
        <div style={{
          marginTop: 14,
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
        }}>
          <Stat label="Overall" value={displayScore(venue) ?? '—'} accent={COLORS.orangeBright} />
          <Stat label="Reviews" value={String(venue.review_count)} />
          <Stat label="Distance" value={<VenueDistance lat={venue.lat} lng={venue.lng} />} />
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
        fontFamily: 'var(--font-label)',
        fontSize: 11,
        fontWeight: 700,
        color: COLORS.textMuted,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 18,
        color: accent ?? COLORS.text,
        marginTop: 2,
      }}>
        {value}
      </div>
    </div>
  );
}
