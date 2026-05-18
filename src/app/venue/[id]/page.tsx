import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VENUE_BY_ID, VENUES } from '@/lib/seed/venues';
import { REVIEWS_BY_VENUE } from '@/lib/seed/reviews';
import { USER_BY_HANDLE } from '@/lib/seed/users';
import { VENUE_TYPE_LABELS } from '@/lib/seed/types';
import { COLORS } from '@/lib/theme';
import { RatingBars } from '@/components/RatingBars';
import { VenueCard } from '@/components/VenueCard';
import {
  StarIcon, ClockIcon, MapPinIcon, VerifiedIcon, ChevronLeftIcon, HeartIcon,
  TruckIcon, CoffeeIcon, HardHatIcon, FlameIcon,
} from '@/components/icons';

export function generateStaticParams() {
  return VENUES.map((v) => ({ id: v.id }));
}

function venueIconFor(type: ReturnType<typeof VENUE_BY_ID.get> extends infer V
  ? V extends { venue_type: infer T } ? T : never : never) {
  if (type === 'gossoko_van') return HardHatIcon;
  if (type === 'food_truck' || type === 'cafe_and_food_truck') return TruckIcon;
  return CoffeeIcon;
}

export default async function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = VENUE_BY_ID.get(id);
  if (!venue) notFound();

  const reviews = REVIEWS_BY_VENUE[venue.id] ?? [];
  const HeroIcon = venueIconFor(venue.venue_type);
  const similar = VENUES
    .filter((v) => v.id !== venue.id && v.venue_type === venue.venue_type)
    .slice(0, 4);

  return (
    <>
      {/* Sticky-feeling top row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 0 8px',
        gap: 10,
      }}>
        <Link
          href="/"
          aria-label="Back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: COLORS.text,
            padding: '8px 10px',
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            background: COLORS.surface,
            minHeight: 40,
          }}
        >
          <ChevronLeftIcon size={18} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Back
          </span>
        </Link>
        <button
          aria-label="Save venue"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            background: COLORS.surface,
            color: COLORS.text,
            cursor: 'pointer',
            minHeight: 40,
          }}
        >
          <HeartIcon size={16} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Save
          </span>
        </button>
      </div>

      {/* Hero block */}
      <section style={{
        background: `linear-gradient(135deg, ${venue.hero_color} 0%, #0a0908 100%)`,
        border: `1px solid ${venue.hero_accent}`,
        borderRadius: 14,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div aria-hidden style={{
          height: 6,
          background: `repeating-linear-gradient(135deg, ${venue.hero_accent} 0 12px, #111 12px 24px)`,
        }} />
        <div style={{ padding: '18px 18px 16px', position: 'relative' }}>
          <div aria-hidden style={{
            position: 'absolute',
            top: 8, right: 12,
            color: venue.hero_accent,
            opacity: 0.7,
          }}>
            <HeroIcon size={68} />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Pill color={COLORS.text} bg="rgba(10,9,8,0.7)" border={COLORS.border}>
              {VENUE_TYPE_LABELS[venue.venue_type]}
            </Pill>
            {venue.open_now ? (
              <Pill color={COLORS.hiVisGreen} bg="rgba(10,9,8,0.7)" border={COLORS.hiVisGreen}>
                <span className="pulse-dot" /> OPEN NOW
              </Pill>
            ) : (
              <Pill color={COLORS.textMuted} bg="rgba(10,9,8,0.7)" border={COLORS.textMuted}>
                CLOSED
              </Pill>
            )}
            {venue.trending && (
              <Pill color={COLORS.orangeHot} bg="rgba(10,9,8,0.7)" border={COLORS.orangeHot}>
                <FlameIcon size={11} /> TRENDING
              </Pill>
            )}
          </div>

          <h1 style={{
            margin: '12px 0 6px',
            fontSize: '1.8rem',
            fontWeight: 800,
            color: COLORS.text,
            textTransform: 'uppercase',
            letterSpacing: '0.005em',
            lineHeight: 1.05,
            paddingRight: 70,
          }}>
            {venue.name}
            {venue.verified && (
              <span style={{ color: COLORS.orange, marginLeft: 6, verticalAlign: 'middle', display: 'inline-flex' }}>
                <VerifiedIcon size={20} />
              </span>
            )}
          </h1>

          <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 14, lineHeight: 1.5, paddingRight: 30 }}>
            {venue.tagline}
          </p>

          {/* Key stat row */}
          <div style={{
            display: 'flex',
            gap: 18,
            marginTop: 16,
            flexWrap: 'wrap',
          }}>
            <Stat label="Overall" value={venue.overall.toFixed(1)} accent={COLORS.orange} />
            <Stat label="Reviews" value={String(venue.review_count)} />
            <Stat label="Distance" value={`${venue.distance_km}km`} />
            <Stat label="Opens" value={venue.opens_at} />
            <Stat label="Closes" value={venue.closes_at} />
          </div>
        </div>
      </section>

      {/* Address line */}
      <section className="section">
        <div style={{
          padding: '12px 14px',
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}>
          <MapPinIcon size={18} style={{ color: COLORS.orange, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14 }}>
              {venue.address}
            </div>
            <div style={{
              color: COLORS.textSecondary,
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginTop: 2,
            }}>
              {venue.suburb} QLD {venue.postcode}
            </div>
          </div>
          <Link
            href="/nearby"
            style={{
              padding: '8px 12px',
              border: `1.5px solid ${COLORS.orange}`,
              borderRadius: 8,
              color: COLORS.orange,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Directions
          </Link>
        </div>
      </section>

      {/* About */}
      <section className="section">
        <div className="section-title"><h2>About</h2></div>
        <div style={{
          padding: '14px 16px',
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderLeft: `4px solid ${venue.hero_accent}`,
          borderRadius: 10,
          color: COLORS.text,
          fontSize: 14,
          lineHeight: 1.55,
        }}>
          {venue.description}
          <div style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px dashed ${COLORS.border}`,
            color: COLORS.orange,
            fontSize: 13,
          }}>
            <strong style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 10.5, color: COLORS.textMuted, marginRight: 8 }}>
              Signature
            </strong>
            {venue.signature}
          </div>
        </div>
      </section>

      {/* Hours + Tags */}
      <section className="section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <InfoBlock
          icon={<ClockIcon size={18} />}
          label="Hours"
          value={`${venue.opens_at} – ${venue.closes_at}`}
        />
        <InfoBlock
          icon={<StarIcon size={18} filled />}
          label="Price"
          value={'$'.repeat(venue.price_level) + ' · ' + ['Cheap', 'Mid', 'Splurge'][venue.price_level - 1]}
        />
      </section>

      {/* Rating breakdown */}
      <section className="section">
        <div className="section-title"><h2>Ratings Breakdown</h2></div>
        <div style={{
          padding: '14px 14px 16px',
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
        }}>
          <RatingBars ratings={venue.ratings} />
        </div>
      </section>

      {/* Tags */}
      {venue.tags.length > 0 && (
        <section className="section">
          <div className="section-title"><h2>Tags</h2></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {venue.tags.map((t) => (
              <span key={t} style={{
                padding: '7px 12px',
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 999,
                color: COLORS.textSecondary,
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="section">
        <div className="section-title">
          <h2>Reviews</h2>
          <span className="mono-chip">{reviews.length} from the crew</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reviews.length === 0 ? (
            <div style={{
              padding: '20px 16px',
              background: COLORS.surface,
              border: `1px dashed ${COLORS.border}`,
              borderRadius: 10,
              color: COLORS.textMuted,
              textAlign: 'center',
              fontSize: 13,
            }}>
              No reviews yet — be the first.
            </div>
          ) : (
            reviews.map((r) => {
              const u = USER_BY_HANDLE.get(r.user_handle);
              if (!u) return null;
              return (
                <article
                  key={r.id}
                  style={{
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: u.avatar_color, color: '#0a0908',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 12,
                    }}>
                      {u.initials}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>
                        @{u.handle}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: COLORS.textMuted,
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}>
                        {u.trade} · {r.posted_at.slice(0, 10)}
                      </div>
                    </div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      color: COLORS.orange,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: 13,
                    }}>
                      <StarIcon size={12} filled /> {r.overall.toFixed(1)}
                    </span>
                  </header>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.text }}>
                    {r.title}
                  </h4>
                  <p style={{ margin: '6px 0 8px', color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 1.55 }}>
                    {r.body}
                  </p>
                  <footer style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: COLORS.textMuted,
                    fontSize: 11.5,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                    <span>{r.helpful_count} found helpful</span>
                    <button style={{
                      background: 'transparent',
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      color: COLORS.text,
                      padding: '6px 10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}>
                      Helpful
                    </button>
                  </footer>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* Similar */}
      {similar.length > 0 && (
        <section className="section">
          <div className="section-title"><h2>Similar Venues</h2></div>
          <div className="h-scroll">
            {similar.map((v) => (
              <VenueCard key={v.id} venue={v} variant="compact" />
            ))}
          </div>
        </section>
      )}

      <div className="hazard-strip" style={{ marginTop: 28 }} />
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
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

function Pill({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '4px 9px',
      background: bg,
      color,
      border: `1px solid ${border}`,
      borderRadius: 4,
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.12em',
      fontWeight: 700,
      textTransform: 'uppercase',
    }}>
      {children}
    </span>
  );
}

function InfoBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: COLORS.orange,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}>
        {icon}
        {label}
      </div>
      <div style={{ marginTop: 4, color: COLORS.text, fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
        {value}
      </div>
    </div>
  );
}
