import { Link } from '@/lib/nav';
import type { Venue } from '@/lib/types';
import { COLORS, RADIUS } from '@/lib/theme';
import { displayScore } from '@/lib/ranking';

/** The spots a tradie has saved, with a DEAL tag when one is running. */
export function SavedSpots({ venues }: { venues: Venue[] }) {
  return (
    <section className="section">
      <div className="section-title"><h2>Saved Spots</h2><span className="mono-chip">{venues.length}</span></div>
      {venues.length === 0 ? (
        <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 1.5 }}>
          Tap Save on a venue to keep it here — handy for the places you hit every week.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {venues.map((v) => (
            <Link key={v.id} href={`/venue/${v.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, textDecoration: 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                <div style={{ color: COLORS.textMuted, fontSize: 11.5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {v.suburb}{v.open_now ? ' · open now' : ''}{v.has_deal ? ' · ⚡ deal' : ''}
                </div>
              </div>
              <span style={{ color: COLORS.orange, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>{displayScore(v) ? `★ ${displayScore(v)}` : 'NEW'}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
