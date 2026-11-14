import { Link, useQuery } from '@/lib/nav';
import { COLORS, BRAND_RIBBON, RADIUS, SPACE, BRAND_GRADIENT } from '@/lib/theme';
import { StarIcon, HardHatIcon, FlameIcon, MapPinIcon, ChevronRightIcon, TrophyIcon } from '@/components/icons';
import { useIsFounder } from '@/lib/founder';
import { useAuth } from '@/lib/auth';
import { useLoad } from '@/lib/useLoad';
import { Skeleton } from '@/components/Skeleton';
import { getOwnProfile, initialsFromName } from '@/lib/queries/profile';
import { getReviewsByUserId } from '@/lib/queries/reviews';
import { DeleteReviewButton } from './DeleteReviewButton';
import { ProfileEditor } from './ProfileEditor';
import { SavedSpots } from './SavedSpots';
import { AlertsToggle } from './AlertsToggle';
import { BiometricToggle } from './BiometricToggle';
import { DeleteAccount } from './DeleteAccount';
import { LegalLinks } from '@/components/LegalLinks';
import { unreadCount } from '@/lib/queries/notifications';
import { getAllVenues } from '@/lib/queries/venues';
import { getManagedVenues, getSavedVenueIds } from '@/lib/queries/business';
import { TRADES } from './ProfileEditor';

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

export default function ProfilePage() {
  const { user: authUser, signOut } = useAuth();
  const founder = useIsFounder();
  const { venue: venueFlag } = useQuery('venue');
  const { data, loading } = useLoad(async () => {
    if (!authUser) return null;
    const profile = await getOwnProfile(authUser.id);
    const reviews = profile ? await getReviewsByUserId(profile.id) : [];
    const [venues, savedIds, managed, unread] = await Promise.all([getAllVenues(), getSavedVenueIds(authUser.id), getManagedVenues(authUser.id), unreadCount()]);
    return { profile, reviews, saved: venues.filter((v) => savedIds.has(v.id)), managed, unread };
  }, [authUser?.id]);
  if (loading && authUser) return <div style={{ padding: 16 }}><Skeleton width={200} height={26} /></div>;

  const profile = data?.profile ?? null;
  const realReviews = data?.reviews ?? [];
  const savedVenues = data?.saved ?? [];
  const managed = data?.managed ?? [];

  let u: ProfileView;
  let myReviews: ReviewRowView[];

  if (authUser && profile) {
    u = {
      handle: profile.username,
      display_name: profile.full_name || profile.username,
      trade: TRADES.find((t) => t.value === profile.trade_type)?.label ?? 'Tradie',
      suburb: 'Brisbane',
      avatar_color: COLORS.orange,
      initials: initialsFromName(profile.full_name || profile.username),
      bio: profile.bio || 'No bio yet — tap Edit profile to add your trade and a line about you.',
      role: profile.role,
      stats: {
        reviews: profile.reviews_count || realReviews.length,
        helpful_marks: realReviews.reduce((sum, r) => sum + r.helpful_count, 0),
        venues_visited: new Set(realReviews.map((r) => r.venue_id)).size,
        streak_days: savedVenues.length,
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
    // Signed out (or no profile row yet): an honest empty card, no sample data.
    u = {
      handle: 'guest',
      display_name: 'Guest',
      trade: 'tradie',
      suburb: 'Brisbane',
      avatar_color: COLORS.orange,
      initials: 'GO',
      bio: 'Sign in to see your reviews, badges and stats.',
      stats: { reviews: 0, helpful_marks: 0, venues_visited: 0, streak_days: 0 },
      badges: [],
    };
    myReviews = [];
  }

  return (
    <>
      <header className="top-bar">
        <div>
          <h1>PROFILE</h1>
          <p className="top-bar__sub">
            {authUser ? 'Signed in' : 'Signed out'} · {u.suburb.toUpperCase()}
          </p>
        </div>
      </header>

      {venueFlag === 'submitted' && (
        <section className="section">
          <div role="status" style={{ padding: '10px 14px', background: COLORS.surface, border: `1px solid ${COLORS.green}`, borderLeft: `4px solid ${COLORS.green}`, borderRadius: RADIUS.md, fontSize: 13 }}>
            Thanks — an admin will check your venue before it goes live. Run the place? Claim it once it&apos;s up.
          </div>
        </section>
      )}

      {!authUser && <SignInCard />}

      {/* Identity card */}
      <section className="section">
        <div style={{
          position: 'relative',
          background: COLORS.surface,
          border: `1.5px solid ${COLORS.border}`,
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          <div aria-hidden style={{ height: 6, background: BRAND_RIBBON }} />
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
                fontFamily: 'var(--font-label)',
                fontSize: 12,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              }}>
                <HardHatIcon size={14} /> @{u.handle} · {u.trade}
                {u.role && u.role !== 'user' && (
                  <span style={{
                    color: '#0a0908',
                    background: COLORS.gold,
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
            <Stat label="Helpful"  value={u.stats.helpful_marks}  accent={COLORS.green} />
            <Stat label="Venues"   value={u.stats.venues_visited} accent={COLORS.text} />
            <Stat label="Saved"    value={u.stats.streak_days}    accent={COLORS.gold} />
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
                fontFamily: 'var(--font-label)',
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
          <ActionTile href="/search" icon={<FlameIcon size={20} />} label="Write a Review" hint="Find the venue first" />
          <ActionTile href="/venue/new" icon={<MapPinIcon size={20} />} label="Add a Venue"    hint="Suggest a new spot" />
          <ActionTile href="/notifications" icon={<FlameIcon size={20} />} label="Alerts" hint={data?.unread ? `${data.unread} new` : 'Reviews and replies'} />
          <ActionTile href="/deals" icon={<StarIcon size={20} />} label="Deals" hint="Codes for smoko" />
          <ActionTile href="/manage" icon={<HardHatIcon size={20} />} label="My Venues" hint={managed.length ? `${managed.length} you manage` : 'Own a place? Claim it'} />
          {founder && <ActionTile href="/founder" icon={<TrophyIcon size={20} />} label="Founder" hint="Owner tools" />}
        </div>
        {authUser && <div style={{ marginTop: 12 }}><AlertsToggle userId={authUser.id} /></div>}
        {authUser && profile && (
          <div style={{ marginTop: 12 }}>
            <ProfileEditor userId={authUser.id} initial={{ username: profile.username, full_name: profile.full_name, bio: profile.bio, trade: profile.trade_type ?? 'tradie' }} />
          </div>
        )}
      </section>

      {authUser && profile && <SavedSpots venues={savedVenues} />}

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
                      fontFamily: 'var(--font-label)',
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
                    fontFamily: 'var(--font-label)',
                    fontWeight: 700,
                    fontSize: 13,
                  }}>
                    <StarIcon size={12} filled /> {r.overall.toFixed(1)}
                  </span>
                  <ChevronRightIcon size={16} style={{ color: COLORS.textMuted }} />
                </Link>

                {/* Bottom row: Edit shortcut + Delete — only for the signed-in owner */}
                {authUser && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Link
                    href={`/review/new?venue=${r.venue_slug}`}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      color: COLORS.textSecondary,
                      padding: '5px 10px',
                      fontFamily: 'var(--font-label)',
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
                  <DeleteReviewButton
                    reviewId={r.id}
                    reviewTitle={r.title}
                  />
                </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Account block — real Supabase session (signed out, the sign-in card sits at the top) */}
      {authUser && (
      <section className="section">
        <div className="section-title"><h2>Account</h2></div>
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
            <BiometricToggle />
            <div>
              <button
                type="button"
                onClick={() => { void signOut(); }}
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
            </div>
            <DeleteAccount onDeleted={() => { void signOut(); }} />
          </div>
      </section>
      )}

      <LegalLinks style={{ marginTop: 20 }} />

      <div className="brand-rule" style={{ marginTop: 28 }} />
    </>
  );
}

/** Signed out: the first thing on Profile is how to sign in or make an account. */
export function SignInCard() {
  return (
    <section className="section" aria-labelledby="profile-signin">
      <div style={{
        background: COLORS.surface,
        border: `1.5px solid ${COLORS.orange}`,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
      }}>
        <div aria-hidden style={{ height: 6, background: BRAND_RIBBON }} />
        <div style={{ padding: SPACE.lg, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
          <div>
            <h2 id="profile-signin" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: COLORS.text, textTransform: 'uppercase' }}>
              Sign in to Gossoko
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: COLORS.textSecondary, lineHeight: 1.5 }}>
              Save spots, get deal codes and post reviews.
            </p>
          </div>
          <div style={{ display: 'flex', gap: SPACE.sm }}>
            <Link
              href="/login"
              style={{
                flex: 1, textAlign: 'center',
                background: BRAND_GRADIENT, color: '#0a0908',
                borderRadius: RADIUS.md, padding: '12px 12px',
                fontWeight: 800, textDecoration: 'none', fontSize: 15,
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
                borderRadius: RADIUS.md, padding: '12px 12px',
                fontWeight: 800, textDecoration: 'none', fontSize: 15,
              }}
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div style={{ padding: '12px 10px', background: COLORS.surface, textAlign: 'center' }}>
      <div style={{
        fontFamily: 'var(--font-label)',
        fontSize: 9.5,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: COLORS.textMuted,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-label)',
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
        fontFamily: 'var(--font-label)',
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
