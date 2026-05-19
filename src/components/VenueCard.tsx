import Link from 'next/link';
import type { Venue } from '@/lib/seed/types';
import { VENUE_TYPE_LABELS } from '@/lib/seed/types';
import { COLORS, RADIUS } from '@/lib/theme';
import { StarIcon, ClockIcon, MapPinIcon, FlameIcon, VerifiedIcon, CoffeeIcon, TruckIcon, HardHatIcon } from './icons';

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
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        position: 'relative',
        minWidth: isCompact ? 220 : undefined,
        width: isCompact ? 220 : '100%',
      }}
    >
      {/* Hero block — coloured panel + venue icon (image-free, on-brand) */}
      <div
        style={{
          position: 'relative',
          height: isCompact ? 100 : isWide ? 120 : 140,
          background: `linear-gradient(135deg, ${venue.hero_color} 0%, #0a0908 100%)`,
          overflow: 'hidden',
        }}
      >
        {/* Hazard stripe corner */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0, right: 0,
            width: 70, height: 14,
            background: `repeating-linear-gradient(135deg, ${venue.hero_accent} 0 8px, #111 8px 16px)`,
          }}
        />
        {/* Venue icon — big, hi-vis tinted */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: 12, bottom: 10,
            color: venue.hero_accent,
            opacity: 0.85,
          }}
        >
          <VenueIcon size={isCompact ? 44 : 56} />
        </div>
        {/* Top-left badges row */}
        <div
          style={{
            position: 'absolute',
            top: 10, left: 10,
            display: 'flex', gap: 6, flexWrap: 'wrap',
          }}
        >
          {venue.open_now ? (
            <span style={pillStyle('#0a0908', COLORS.hiVisGreen)}>
              <span className="pulse-dot" />
              OPEN NOW
            </span>
          ) : (
            <span style={pillStyle('#0a0908', COLORS.textMuted)}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.textMuted, display: 'inline-block' }} />
              CLOSED
            </span>
          )}
          {venue.trending && (
            <span style={pillStyle('#0a0908', COLORS.orangeHot)}>
              <FlameIcon size={12} />
              TRENDING
            </span>
          )}
        </div>
        {/* Bottom-left venue type */}
        <div style={{ position: 'absolute', left: 12, bottom: 10 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: COLORS.textSecondary,
            background: 'rgba(10, 9, 8, 0.65)',
            padding: '4px 8px',
            borderRadius: 4,
            border: `1px solid ${COLORS.border}`,
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
                fontSize: isCompact ? '0.98rem' : '1.08rem',
                fontWeight: 700,
                color: COLORS.text,
                letterSpacing: '0.005em',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
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
              gap: 8,
              flexWrap: 'wrap',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPinIcon size={12} /> {venue.suburb}
              </span>
              <span aria-hidden style={{ opacity: 0.5 }}>·</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: COLORS.textMuted }}>
                {venue.distance_km}km
              </span>
              <span aria-hidden style={{ opacity: 0.5 }}>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ClockIcon size={12} /> {venue.opens_at}
              </span>
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              background: COLORS.orangeFaint,
              border: `1px solid ${COLORS.orange}`,
              borderRadius: 6,
              color: COLORS.orange,
            }}>
              <StarIcon size={13} filled />
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.04em' }}>
                {venue.overall.toFixed(1)}
              </strong>
            </div>
            <span style={{
              marginTop: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.1em',
              color: COLORS.textMuted,
            }}>
              {venue.review_count} REVIEWS
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
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: COLORS.textSecondary,
                padding: '4px 8px',
                background: COLORS.surfaceAlt,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 4,
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

function pillStyle(bg: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 8px',
    background: bg,
    color,
    border: `1px solid ${color}`,
    borderRadius: 4,
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '0.12em',
    fontWeight: 700,
    textTransform: 'uppercase',
  };
}
