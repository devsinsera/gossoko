import { Link } from '@/lib/nav';
import type { Venue } from '@/lib/types';
import { VENUE_TYPE_LABELS } from '@/lib/types';
import pinUrl from '@/assets/brand/gossoko-pin.svg';
import { COLORS, RADIUS } from '@/lib/theme';
import { StarIcon, ClockIcon, MapPinIcon, FlameIcon, ZapIcon, VerifiedIcon, CoffeeIcon, TruckIcon, HardHatIcon } from './icons';
import { VenueDistance } from './VenueDistance';
import { displayScore, reviewCountLabel } from '@/lib/ranking';

function venueIcon(type: Venue['venue_type']) {
  if (type === 'gossoko_van') return HardHatIcon;
  if (type === 'food_truck' || type === 'cafe_and_food_truck') return TruckIcon;
  if (type === 'cafe' || type === 'bakery' || type === 'snack_bar') return CoffeeIcon;
  return CoffeeIcon;
}

export function VenueCard({ venue, variant = 'full' }: { venue: Venue; variant?: 'full' | 'compact' | 'wide' }) {
  const VenueIcon = venueIcon(venue.venue_type);
  const isCompact = variant === 'compact';
  const isWide = variant === 'wide';

  return (
    <Link
      href={`/venue/${venue.slug}`}
      style={{
        display: 'block',
        background: `var(--crema), ${COLORS.surface}`,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.xl,
        boxShadow: '0 14px 30px -22px rgba(0, 0, 0, 0.9)',
        overflow: 'hidden',
        position: 'relative',
        minWidth: isCompact ? 220 : undefined,
        width: isCompact ? 220 : '100%',
      }}
    >
      {/* Hero block — crema panel with the brand pin and the venue's kind of place */}
      <div
        style={{
          position: 'relative',
          height: isCompact ? 104 : isWide ? 120 : 138,
          background: `radial-gradient(120% 120% at 85% 100%, rgba(255, 122, 0, 0.30) 0%, rgba(142, 74, 28, 0.35) 38%, rgba(42, 20, 8, 0.6) 70%, ${COLORS.bgElev} 100%)`,
          overflow: 'hidden',
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        {/* The pin, cropped off the right edge, with the venue glyph in cream beside it */}
        <img
          src={pinUrl}
          alt=""
          aria-hidden
          draggable={false}
          style={{ position: 'absolute', right: -6, bottom: -18, height: isCompact ? 104 : 132, opacity: 0.95, pointerEvents: 'none' }}
        />
        <div aria-hidden style={{ position: 'absolute', right: isCompact ? 70 : 92, bottom: 12, color: COLORS.cream, opacity: 0.55 }}>
          <VenueIcon size={isCompact ? 26 : 30} />
        </div>
        {/* Top-left badges row */}
        <div
          style={{
            position: 'absolute',
            top: 10, left: 10, right: isCompact ? 60 : 80,
            display: 'flex', gap: 6, flexWrap: 'wrap',
          }}
        >
          {venue.open_now ? (
            <span className="badge badge--open">
              <span className="pulse-dot" />
              Open now
            </span>
          ) : (
            <span className="badge badge--closed">Closed</span>
          )}
          {venue.has_deal && (
            <span className="badge badge--deal">
              <ZapIcon size={12} />
              Deal
            </span>
          )}
          {venue.trending && (
            <span className="badge badge--hot">
              <FlameIcon size={12} />
              Trending
            </span>
          )}
        </div>
        {/* Bottom-left venue type */}
        <div style={{ position: 'absolute', left: 12, bottom: 10 }}>
          <span style={{
            fontFamily: 'var(--font-label)',
            fontSize: 11,
            fontWeight: 700,
            color: COLORS.cream,
            background: 'rgba(10, 9, 8, 0.6)',
            padding: '4px 9px',
            borderRadius: 999,
            border: `1px solid ${COLORS.borderStrong}`,
          }}>
            {VENUE_TYPE_LABELS[venue.venue_type]}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h3 style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                fontSize: isCompact ? '0.95rem' : '1.05rem',
                color: COLORS.text,
                letterSpacing: '0.005em',
                lineHeight: 1.2,
                overflow: 'hidden',
                // Compact cards are narrow: wrap to two lines rather than cut "Crowbar C…".
                ...(isCompact
                  ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflowWrap: 'anywhere' as const }
                  : { textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }),
              }}>
                {venue.name}
              </h3>
              {venue.verified && (
                <span aria-label="Verified" title="Verified" style={{ color: COLORS.orange, display: 'inline-flex', flexShrink: 0 }}>
                  <VerifiedIcon size={14} />
                </span>
              )}
            </div>
            <p style={{
              margin: '4px 0 0',
              color: COLORS.textSecondary,
              fontSize: 12.5,
              display: 'flex',
              alignItems: 'center',
              // No "·" separators: in a narrow card they wrap and dangle at line ends.
              gap: '4px 12px',
              flexWrap: 'wrap',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPinIcon size={12} /> {venue.suburb}
              </span>
              <span style={{ fontFamily: 'var(--font-label)', fontSize: 11.5, color: COLORS.textMuted }}>
                <VenueDistance lat={venue.lat} lng={venue.lng} />
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ClockIcon size={12} /> {venue.opens_at}
              </span>
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
            {displayScore(venue) ? (
              <span className="score-sticker"><StarIcon size={12} filled />{displayScore(venue)}</span>
            ) : (
              <span className="score-sticker score-sticker--new">NEW</span>
            )}
            <span style={{
              marginTop: 6,
              fontFamily: 'var(--font-label)',
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.textMuted,
              whiteSpace: 'nowrap',
            }}>
              {reviewCountLabel(venue.review_count)}
            </span>
          </div>
        </div>

        {!isCompact && (
          <p style={{
            margin: '10px 0 0',
            color: COLORS.textSecondary,
            fontSize: 13,
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {venue.tagline}
          </p>
        )}

        {!isCompact && venue.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {venue.tags.slice(0, 3).map((t) => (
              <span key={t} style={{
                fontFamily: 'var(--font-label)',
                fontSize: 11.5,
                fontWeight: 700,
                color: COLORS.textSecondary,
                padding: '4px 10px',
                background: COLORS.surfaceAlt,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 999,
              }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
