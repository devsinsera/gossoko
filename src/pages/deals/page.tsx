import { useState } from 'react';
import { Link } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
import { useLoad } from '@/lib/useLoad';
import { getLiveDeals, getMyActiveCodes } from '@/lib/queries/business';
import { DealCard } from '@/components/DealCard';
import { COLORS } from '@/lib/theme';

/** Every deal running now. Tradies get a code, show it at the counter. */
export default function DealsPage() {
  const { user } = useAuth();
  const [endingSoon, setEndingSoon] = useState(false);
  const { data, loading } = useLoad(async () => {
    const [deals, codes] = await Promise.all([getLiveDeals(), user ? getMyActiveCodes(user.id) : Promise.resolve(new Map())]);
    return { deals, codes };
  }, [user?.id]);

  const soon = Date.now() + 24 * 3600_000;
  const deals = (data?.deals ?? []).filter((d) => !endingSoon || Date.parse(d.end_date) < soon);

  return (
    <>
      <header className="top-bar">
        <div>
          <h1>DEALS</h1>
          <p className="top-bar__sub">Smoko specials from places that know tradies</p>
        </div>
      </header>
      <div className="h-scroll" role="tablist" style={{ marginTop: 4 }}>
        {[{ id: false, label: 'All deals' }, { id: true, label: 'Ending today' }].map((t) => (
          <button key={String(t.id)} type="button" role="tab" aria-selected={endingSoon === t.id} onClick={() => setEndingSoon(t.id)}
            style={{ flex: '0 0 auto', padding: '9px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, textTransform: 'uppercase',
              border: `1.5px solid ${endingSoon === t.id ? COLORS.orange : COLORS.border}`, background: endingSoon === t.id ? COLORS.orange : COLORS.surface, color: endingSoon === t.id ? '#0a0908' : COLORS.text }}>
            {t.label}
          </button>
        ))}
      </div>
      <section className="section">
        {loading && !data ? <p style={{ color: COLORS.textSecondary }}>Loading…</p> : deals.length === 0 ? (
          <p style={{ color: COLORS.textSecondary, lineHeight: 1.55 }}>
            {endingSoon ? 'Nothing ends today.' : 'No deals running right now.'} Own a venue?{' '}
            <Link href="/manage" style={{ color: COLORS.orange }}>Post one from your dashboard</Link> — it shows up here straight away.
          </p>
        ) : (
          <div className="card-list">
            {deals.map((d) => <DealCard key={d.id} deal={d} code={data?.codes.get(d.id)} signedIn={!!user} showVenue />)}
          </div>
        )}
      </section>
    </>
  );
}
