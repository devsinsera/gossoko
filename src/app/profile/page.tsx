import Link from 'next/link';
import { CURRENT_USER } from '@/lib/seed/users';
import { REVIEWS } from '@/lib/seed/reviews';
import { VENUE_BY_ID } from '@/lib/seed/venues';
import { COLORS, HAZARD_STRIPES, RADIUS, SPACE } from '@/lib/theme';
import { StarIcon, HardHatIcon, FlameIcon, MapPinIcon, ChevronRightIcon } from '@/components/icons';
import { getCurrentUser } from '@/lib/auth/permissions';
import { getOwnProfile, initialsFromName } from '@/lib/queries/profile';
import { getReviewsByUserId } from '@/lib/queries/reviews';
import { signOutAction } from '../_auth/sign-out';
import { DeleteReviewButton } from './DeleteReviewButton';

export const dynamic = 'force-dynamic';

interface ProfileView {
  handle: string;
  display_name: string;
  trade: string;
  suburb: string;
  avatar_color: string;
  initials: string;
  bio: string;
  role?: 'user' | 'moderator' | 'admin' | 'business';
  stats: {
    reviews: number;
    helpful_marks: number;
    venues_visited: number;
    streak_days: number;
  };
  badges: { code: string; label: string; color: string }[];
}

interface ReviewRowView {
  id: string;
  title: string;
  venue_slug: string;
  venue_name: string;
  overall: number;
}

export default async function ProfilePage() {
  const authUser = await getCurrentUser();
  const profile = authUser ? await getOwnProfile(authUser.id) : null;
  const realReviews = profile ? await getReviewsByUserId(profile.id) : [];

  let u: ProfileView;
  let myReviews: ReviewRowView[];

  if (authUser && profile) {
    u = {
      handle: profile.username,
      display_name: profile.full_name || profile.username,
      trade: profile.trade_type ?? 'tradie',
      suburb: 'Brisbane',
      avatar_color: COLORS.orange,
      initials: initialsFromName(profile.full_name || profile.username),
      bio: profile.bio || 'No bio yet. Add one from settings (coming soon).',
      role: profile.role,
      stats: {
        reviews: profile.reviews_count || realReviews.length,
        helpful_marks: realReviews.reduce((sum, r) => sum + r.helpful_count, 0),
        venues_visited: new Set(realReviews.map((r) => r.venue_id)).size,
        streak_days: 0,
      },
      badges: profile.is_verified ? [{ code: 'verified', label: 'Verified', color: COLORS.orange }] : [],
    };
    myReviews = realReviews.slice(0, 6).map((r) => ({
      id: r.id,
      title: r.title,
      venue_slug: r.venue_slug,
      venue_name: r.venue_name,
      overall: r.overall,
    }));
  } else {
    const s = CURRENT_USER;
    u = { ...s };
    myReviews = REVIEWS
      .filter((r) => r.user_handle === s.handle)
      .slice(0, 6)
      .map((r) => {
        const v = VENUE_BY_ID.get(r.venue_id);
        return v ? { id: r.id, title: r.title, venue_slug: v.slug, venue_name: v.name, overall: r.overall } : null;
      })
      .filter((r): r is ReviewRowView => r !== null);
  }

  return (
    <>
      <header className="top-bar">
        <div>
          <h1>PROFILE</h1>
          <p className="top-bar__sub">
            {authUser ? 'Signed in' : 'Demo · sign in to see your own'} · {u.suburb.toUpperCase()}
          </p>
        </div>
      </header>

      {/* Identity card */}
      <section className="section">
        <div style={{
          position: 'relative',
          background: COLORS.surface,
          border: `1.5px solid ${COLORS.border}`,
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          <div aria-hidden style={{ height: 6, background: HAZARD_STRIPES }} />
          <div style={{ padding: '18px 16px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{
              width: 64, height: 64,
              borderRadius: '50%',
              background: u.avatar_color,
              color: '#0a0908',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              fontWeight: 800,
              border: `2px solid #0a0908`,
              boxShadow: `0 0 0 3px ${u.avatar_color}55`,
            }}>
              {u.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{
                margin: 0,
                fontSize: '1.4rem',
                fontWeight: 800,
                color: COLORS.text,
                textTransform: 'uppercase',
                letterSpacing: '0.01em',
              }}>
                {u.display_name}
              </h2>
              <p style={{
                margin: '2px 0 0',
                color: COLORS.orange,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              }}>
                <HardHatIcon size={14} /> @{u.handle} · {u.trade}
                {u.role && u.role !== 'user' && (
                  <span style={{
                    color: '#0a0908',
                    background: COLORS.hiVisYellow,
                    padding: '1px 6px',
                    borderRadius: 4,
                    letterSpacing: '0.1em',
                    fontWeight: 800,
                  }}>{u.role}</span>
                )}
              </p>
            </div>
          </div>
          <p style={{ margin: '0 16px 14px', color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 1.5 }}>
            {u.bio}
          </p>

          {/* Stat grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1,
            background: COLORS.border,
            borderTop: `1px solid ${COLORS.border}`,
          }}>
            <Stat label="Reviews"  value={u.stats.reviews}        accent={COLORS.orange} />
            <Stat label="Helpful"  value={u.stats.helpful_marks}  accent={COLORS.hiVisGreen} />
            <Stat label="Venues"   value={u.stats.venues_visited} accent={COLORS.text} />
            <Stat label="Streak"   value={`${u.stats.streak_days}d`} accent={COLORS.hiVisYellow} />
          </div>
        </div>
      </section>

      {/* Badges */}
      {u.badges.length > 0 && (
        <section className="section">
          <div className="section-title"><h2>Badges</h2></div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {u.badges.map((b) => (
              <div key={b.code} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                background: COLORS.surface,
                border: `1.5px solid ${b.color}`,
                borderRadius: 999,
                color: b.color,
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                <StarIcon size={12} filled />
                {b.label}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <ActionTile href="/" icon={<FlameIcon size={20} />} label="Write a Review" hint="Pick a venue first" />
          <ActionTile href="/venue/new" icon={<MapPinIcon size={20} />} label="Add a Venue"    hint="Suggest a new spot" />
        </div>
      </section>

      {/* My recent reviews */}
      <section className="section">
        <div className="section-title">
          <h2>My Recent Reviews</h2>
          <span className="mono-chip">{u.stats.reviews} total</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myReviews.length === 0 ? (
            <div style={{
              padding: '14px 16px',
              background: COLORS.surface,
              border: `1px dashed ${COLORS.border}`,
              borderRadius: 10,
              color: COLORS.textMuted,
              fontSize: 13,
              textAlign: 'center',
            }}>
              No reviews yet — pick a venue and write your first.
            </div>
          ) : (
            myReviews.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '12px 14px',
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {/* Top row: review info + star rating + venue link chevron */}
                <Link
                  href={`/venue/${r.venue_slug}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: 10,
                    alignItems: 'center',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: COLORS.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {r.title}
                    </div>
                    <div style={{
                      color: COLORS.textSecondary,
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      marginTop: 2,
                    }}>
                      on {r.venue_name}
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: COLORS.orange,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: 13,
                  }}>
                    <StarIcon size={12} filled /> {r.overall.toFixed(1)}
                  </span>
                  <ChevronRightIcon size={16} style={{ color: COLORS.textMuted }} />
                </Link>

                {/* Bottom row: Edit shortcut + Delete */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Link
                    href={`/review/new?venue=${r.venue_slug}`}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      color: COLORS.textSecondary,
                      padding: '5px 10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Edit
                  </Link>
                  {authUser && (
                    <DeleteReviewButton
                      reviewId={r.id}
                      venueSlug={r.venue_slug}
                      reviewTitle={r.title}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Account block — real Supabase session */}
      <section className="section">
        <div className="section-title"><h2>Account</h2></div>
        {authUser ? (
          <div style={{
            background: COLORS.surface,
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: RADIUS.lg,
            padding: SPACE.lg,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.md,
          }}>
            <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
              Signed in as
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, wordBreak: 'break-all' }}>
              {authUser.email}
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                style={{
                  background: 'transparent',
                  color: COLORS.red,
                  border: `1.5px solid ${COLORS.red}`,
                  borderRadius: RADIUS.md,
                  padding: '10px 16px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  letterSpacing: 0.5,
                }}
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div style={{
            background: COLORS.surface,
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: RADIUS.lg,
            padding: SPACE.lg,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.sm,
          }}>
            <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
              Not signed in — the data above is demo content.
            </div>
            <div style={{ display: 'flex', gap: SPACE.sm }}>
              <Link
                href="/login"
                style={{
                  flex: 1, textAlign: 'center',
                  background: COLORS.orange, color: '#0a0908',
                  borderRadius: RADIUS.md, padding: '10px 12px',
                  fontWeight: 800, textDecoration: 'none', fontSize: 14,
                }}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                style={{
                  flex: 1, textAlign: 'center',
                  background: 'transparent', color: COLORS.orange,
                  border: `1.5px solid ${COLORS.orange}`,
                  borderRadius: RADIUS.md, padding: '10px 12px',
                  fontWeight: 800, textDecoration: 'none', fontSize: 14,
                }}
              >
                Create account
              </Link>
            </div>
          </div>
        )}
      </section>

      <div className="hazard-strip" style={{ marginTop: 28 }} />
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div style={{ padding: '12px 10px', background: COLORS.surface, textAlign: 'center' }}>
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
        fontWeight: 800,
        color: accent,
        marginTop: 2,
      }}>
        {value}
      </div>
    </div>
  );
}

function ActionTile({ icon, label, hint, href }: { icon: React.ReactNode; label: string; hint: string; href: string }) {
  return (
    <Link href={href} style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '14px 14px',
      background: COLORS.surface,
      border: `1.5px solid ${COLORS.border}`,
      borderRadius: 10,
      color: COLORS.text,
      textAlign: 'left',
      textDecoration: 'none',
      minHeight: 80,
    }}>
      <span style={{ color: COLORS.orange }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: COLORS.textMuted,
      }}>
        {hint}
      </span>
    </Link>
  );
}
