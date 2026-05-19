import Link from 'next/link';
import { CURRENT_USER } from '@/lib/seed/users';
import { REVIEWS } from '@/lib/seed/reviews';
import { VENUE_BY_ID } from '@/lib/seed/venues';
import { COLORS, HAZARD_STRIPES } from '@/lib/theme';
import { StarIcon, HardHatIcon, FlameIcon, MapPinIcon, ChevronRightIcon } from '@/components/icons';

export default function ProfilePage() {
  const u = CURRENT_USER;
  const myReviews = REVIEWS.filter((r) => r.user_handle === u.handle).slice(0, 6);

  return (
    <>
      <header className="top-bar">
        <div>
          <h1>PROFILE</h1>
          <p className="top-bar__sub">Signed in · {u.suburb.toUpperCase()}</p>
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
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <HardHatIcon size={14} /> @{u.handle} · {u.trade}
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
          <ActionTile icon={<FlameIcon size={20} />} label="Write a Review" hint="Earn helpful marks" />
          <ActionTile icon={<MapPinIcon size={20} />} label="Add a Venue"    hint="Help the crew" />
        </div>
      </section>

      {/* My recent reviews */}
      <section className="section">
        <div className="section-title">
          <h2>My Recent Reviews</h2>
          <span className="mono-chip">{u.stats.reviews} total</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myReviews.map((r) => {
            const v = VENUE_BY_ID.get(r.venue_id);
            if (!v) return null;
            return (
              <Link
                key={r.id}
                href={`/venue/${v.slug}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
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
                    on {v.name}
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
            );
          })}
        </div>
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

function ActionTile({ icon, label, hint }: { icon: React.ReactNode; label: string; hint: string }) {
  return (
    <button style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '14px 14px',
      background: COLORS.surface,
      border: `1.5px solid ${COLORS.border}`,
      borderRadius: 10,
      color: COLORS.text,
      textAlign: 'left',
      cursor: 'pointer',
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
    </button>
  );
}
