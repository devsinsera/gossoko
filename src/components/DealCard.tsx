import { useEffect, useState } from 'react';
import { Link } from '@/lib/nav';
import { COLORS, RADIUS, BRAND_GRADIENT } from '@/lib/theme';
import { dealBadge, soldOut, type Deal, type DealCode } from '@/lib/queries/business';
import { claimDealCode } from '@/pages/_business/actions';
import { ZapIcon } from './icons';

function timeLeft(iso: string, now: number): string {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return 'ended';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min left`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m left`;
  return `${Math.floor(h / 24)} days left`;
}

/** One running deal. A signed-in tradie taps Get code, then shows the code at the counter. */
export function DealCard({ deal, code, signedIn, showVenue = false }: {
  deal: Deal;
  code?: DealCode;
  signedIn: boolean;
  showVenue?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const [mine, setMine] = useState<DealCode | undefined>(code);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setMine(code); }, [code]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const gone = soldOut(deal);
  const codeLive = mine && Date.parse(mine.expires_at) > now;

  async function get() {
    setBusy(true);
    setError(null);
    const res = await claimDealCode(deal.id);
    setBusy(false);
    if (res.ok) setMine({ special_id: deal.id, code: res.code, expires_at: res.expires_at });
    else setError(res.error);
  }

  return (
    <article style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.orange}`,
      borderRadius: RADIUS.lg,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4,
          background: BRAND_GRADIENT, color: '#0a0908', fontFamily: 'var(--font-label)', fontWeight: 800, fontSize: 11, letterSpacing: '0.08em',
        }}>
          <ZapIcon size={12} /> {dealBadge(deal)}
        </span>
        <span style={{ marginLeft: 'auto', color: COLORS.textMuted, fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {timeLeft(deal.end_date, now)}
        </span>
      </header>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: COLORS.text }}>{deal.title}</h3>
      {showVenue && deal.venue && (
        <Link href={`/venue/${deal.venue.slug}`} style={{ color: COLORS.orange, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          {deal.venue.name} · {deal.venue.suburb}
        </Link>
      )}
      {deal.description && <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 1.5 }}>{deal.description}</p>}
      {deal.terms && <p style={{ margin: 0, color: COLORS.textMuted, fontSize: 11.5 }}>{deal.terms}</p>}
      {deal.max_redemptions != null && (
        <p style={{ margin: 0, color: COLORS.textMuted, fontSize: 11.5, fontFamily: 'var(--font-label)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {Math.max(0, deal.max_redemptions - deal.redeemed_count)} of {deal.max_redemptions} left
        </p>
      )}

      {codeLive ? (
        <div style={{ textAlign: 'center', padding: '10px 0 4px', borderTop: `1px dashed ${COLORS.borderStrong}` }}>
          <div aria-label={`Your code is ${mine!.code}`} style={{ fontFamily: 'var(--font-label)', fontSize: 34, fontWeight: 800, letterSpacing: '0.16em', color: COLORS.green }}>
            {mine!.code}
          </div>
          <div style={{ color: COLORS.textSecondary, fontSize: 12.5 }}>
            Show this at the counter · {timeLeft(mine!.expires_at, now)}
          </div>
        </div>
      ) : gone ? (
        <div style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: 700 }}>Sold out</div>
      ) : !signedIn ? (
        <Link href={`/login?next=${encodeURIComponent(deal.venue ? `/venue/${deal.venue.slug}` : '/deals')}`}
          style={{ textAlign: 'center', padding: 11, borderRadius: RADIUS.md, border: `1.5px solid ${COLORS.orange}`, color: COLORS.orange, fontWeight: 800, fontSize: 13.5, textDecoration: 'none' }}>
          Sign in to get the code
        </Link>
      ) : (
        <button type="button" onClick={get} disabled={busy}
          style={{ padding: 12, borderRadius: RADIUS.md, border: 'none', background: BRAND_GRADIENT, color: '#0a0908', fontWeight: 800, fontSize: 14, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Getting your code…' : 'Get code'}
        </button>
      )}
      {error && <p role="alert" style={{ margin: 0, color: COLORS.red, fontSize: 12.5 }}>{error}</p>}
    </article>
  );
}
