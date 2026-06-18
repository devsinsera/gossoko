import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getVenueBySlug, getAllVenues } from '@/lib/queries/venues';
import { getReviewsByVenueId, getUserLikedReviewIds } from '@/lib/queries/reviews';
import { getCommentsByReviewIds } from '@/lib/queries/comments';
import { getCurrentUser } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { claimVenue } from '../../_claims/actions';
import { HelpfulButton } from '../../_likes/HelpfulButton';
import { CommentsSection } from '../../_comments/CommentsSection';
import { VENUE_TYPE_LABELS } from '@/lib/seed/types';
import type { VenueType } from '@/lib/seed/types';
import { COLORS, RADIUS, SPACE } from '@/lib/theme';
import { RatingBars } from '@/components/RatingBars';
import { VenueCard } from '@/components/VenueCard';
import { VenueDistance } from '@/components/VenueDistance';
import { ReportButton } from '../../_report/ReportButton';
import {
  StarIcon, ClockIcon, MapPinIcon, VerifiedIcon, ChevronLeftIcon, HeartIcon,
  TruckIcon, CoffeeIcon, HardHatIcon, FlameIcon,
} from '@/components/icons';

function venueIconFor(type: VenueType) {
  if (type === 'gossoko_van') return HardHatIcon;
  if (type === 'food_truck' || type === 'cafe_and_food_truck') return TruckIcon;
  return CoffeeIcon;
}

const REPORT_BANNER: Record<string, { color: string; text: string }> = {
  submitted: { color: COLORS.hiVisGreen, text: 'Report sent. Moderators will take a look.' },
  invalid:   { color: COLORS.red,         text: 'Report could not be sent — please pick a reason and add a detail.' },
  error:     { color: COLORS.red,         text: 'Something went wrong saving the report. Try again.' },
};

const REVIEW_BANNER: Record<string, { color: string; text: string }> = {
  submitted: { color: COLORS.hiVisGreen, text: 'Review posted. Cheers for the rundown.' },
  updated:   { color: COLORS.hiVisGreen, text: 'Review updated.' },
};

const CLAIM_BANNER: Record<string, { color: string; text: string }> = {
  submitted: { color: COLORS.hiVisGreen, text: 'Claim submitted. An admin will review it shortly.' },
  exists:    { color: COLORS.hiVisYellow, text: 'You already have a claim pending review for this venue.' },
  owner:     { color: COLORS.hiVisGreen, text: 'You already manage this venue.' },
  error:     { color: COLORS.red,         text: 'Something went wrong saving your claim. Try again.' },
};

export default async function VenueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ report?: string; review?: string; claim?: string }>;
}) {
  const { slug } = await params;
  const { report, review, claim } = await searchParams;
  const venue = await getVenueBySlug(slug);
  if (!venue) notFound();
  const reportBanner = report ? REPORT_BANNER[report] : null;
  const reviewBanner = review ? REVIEW_BANNER[review] : null;
  const claimBanner = claim ? CLAIM_BANNER[claim] : null;

  const reviews = await getReviewsByVenueId(venue.id);
  const currentUser = await getCurrentUser();

  // Claim-state lookup, only relevant to a signed-in user: does the user own
  // this venue, and do they already have a live claim for it? Skipped entirely
  // for anonymous visitors (who always see the "sign in to claim" affordance),
  // and run as a single parallel round-trip. (getVenueBySlug doesn't select
  // created_by.)
  let ownsVenue = false;
  let userClaimStatus: string | null = null;
  if (currentUser) {
    const supabase = await createClient();
    const [ownerRes, claimRes] = await Promise.all([
      supabase.from('venues').select('created_by').eq('id', venue.id).maybeSingle(),
      supabase
        .from('venue_claims')
        .select('status')
        .eq('venue_id', venue.id)
        .eq('user_id', currentUser.id)
        .is('deleted_at', null)
        .maybeSingle(),
    ]);
    ownsVenue = ownerRes.data?.created_by === currentUser.id;
    userClaimStatus = ownsVenue ? null : (claimRes.data?.status ?? null);
  }
  const [likedSet, commentsMap] = await Promise.all([
    currentUser
      ? getUserLikedReviewIds(currentUser.id, reviews.map((r) => r.id))
      : Promise.resolve(new Set<string>()),
    getCommentsByReviewIds(reviews.map((r) => r.id)),
  ]);
  const HeroIcon = venueIconFor(venue.venue_type);
  const allVenues = await getAllVenues();
  const similar = allVenues
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
            <Stat label="Distance" value={<VenueDistance lat={venue.lat} lng={venue.lng} fallbackKm={venue.distance_km} />} />
            <Stat label="Opens" value={venue.opens_at} />
            <Stat label="Closes" value={venue.closes_at} />
          </div>
        </div>
      </section>

      {/* Report-result banner */}
      {reportBanner && (
        <section className="section">
          <div style={{
            padding: '10px 14px',
            background: COLORS.surface,
            border: `1px solid ${reportBanner.color}`,
            borderLeft: `4px solid ${reportBanner.color}`,
            borderRadius: RADIUS.md,
            color: COLORS.text,
            fontSize: 13,
          }}>
            {reportBanner.text}
          </div>
        </section>
      )}

      {/* Review-result banner */}
      {reviewBanner && (
        <section className="section">
          <div style={{
            padding: '10px 14px',
            background: COLORS.surface,
            border: `1px solid ${reviewBanner.color}`,
            borderLeft: `4px solid ${reviewBanner.color}`,
            borderRadius: RADIUS.md,
            color: COLORS.text,
            fontSize: 13,
          }}>
            {reviewBanner.text}
          </div>
        </section>
      )}

      {/* Claim-result banner */}
      {claimBanner && (
        <section className="section">
          <div style={{
            padding: '10px 14px',
            background: COLORS.surface,
            border: `1px solid ${claimBanner.color}`,
            borderLeft: `4px solid ${claimBanner.color}`,
            borderRadius: RADIUS.md,
            color: COLORS.text,
            fontSize: 13,
          }}>
            {claimBanner.text}
          </div>
        </section>
      )}

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
            reviews.map((r) => (
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
                    background: COLORS.orange, color: '#0a0908',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 12,
                  }}>
                    {r.user.initials}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>
                      @{r.user.username}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: COLORS.textMuted,
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}>
                      {r.user.trade} · {r.posted_at.slice(0, 10)}
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
                  gap: 8,
                  flexWrap: 'wrap',
                }}>
                  <span>{r.helpful_count} found helpful</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <HelpfulButton
                      reviewId={r.id}
                      initialLiked={likedSet.has(r.id)}
                      initialCount={r.helpful_count}
                      venueSlug={venue.slug}
                      isSignedIn={!!currentUser}
                    />
                    <ReportButton reportableType="review" reportableId={r.id} back={`/venue/${venue.slug}`} />
                  </div>
                </footer>
                <CommentsSection
                  reviewId={r.id}
                  venueSlug={venue.slug}
                  initialComments={commentsMap.get(r.id) ?? []}
                  isSignedIn={!!currentUser}
                />
              </article>
            ))
          )}
          <Link
            href={`/review/new?venue=${venue.slug}`}
            style={{
              marginTop: SPACE.sm,
              textAlign: 'center',
              background: COLORS.orange,
              color: '#0a0908',
              borderRadius: RADIUS.md,
              padding: 12,
              fontWeight: 800,
              fontSize: 14,
              textDecoration: 'none',
              letterSpacing: 0.5,
            }}
          >
            Write a review
          </Link>
        </div>
      </section>

      {/* Claim this venue */}
      <section className="section">
        <div className="section-title"><h2>Own this venue?</h2></div>
        <div style={{
          padding: '14px 16px',
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {ownsVenue || userClaimStatus === 'approved' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: COLORS.hiVisGreen, fontSize: 13.5, fontWeight: 700 }}>
              <VerifiedIcon size={16} />
              You manage this venue.
            </div>
          ) : userClaimStatus === 'pending' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: COLORS.hiVisYellow, fontSize: 13.5, fontWeight: 700 }}>
              <span className="pulse-dot" />
              Claim pending review.
            </div>
          ) : userClaimStatus === 'rejected' ? (
            <div style={{ color: COLORS.textSecondary, fontSize: 13 }}>
              Your previous claim for this venue was declined. Get in touch if you think that&apos;s wrong.
            </div>
          ) : !currentUser ? (
            <>
              <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
                Run this gossoko van, food truck or café? Sign in to claim it and keep its listing accurate.
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(`/venue/${venue.slug}`)}`}
                style={{
                  alignSelf: 'flex-start',
                  background: COLORS.orange,
                  color: '#0a0908',
                  borderRadius: RADIUS.md,
                  padding: '10px 16px',
                  fontWeight: 800,
                  fontSize: 13,
                  textDecoration: 'none',
                  letterSpacing: 0.5,
                }}
              >
                Sign in to claim
              </Link>
            </>
          ) : (
            <>
              <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
                Run this gossoko van, food truck or café? Claim it and an admin will verify you as the owner.
              </p>
              <form action={claimVenue} style={{ alignSelf: 'flex-start' }}>
                <input type="hidden" name="venueId" value={venue.id} />
                <input type="hidden" name="venueSlug" value={venue.slug} />
                <button
                  type="submit"
                  style={{
                    background: COLORS.orange,
                    color: '#0a0908',
                    border: 'none',
                    borderRadius: RADIUS.md,
                    padding: '10px 16px',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    letterSpacing: 0.5,
                  }}
                >
                  Claim this venue
                </button>
              </form>
            </>
          )}
        </div>
      </section>

      {/* Report this venue */}
      <section className="section">
        <div className="section-title"><h2>Something off about this listing?</h2></div>
        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: SPACE.sm }}>
          <ReportButton reportableType="venue" reportableId={venue.id} back={`/venue/${venue.slug}`} />
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
