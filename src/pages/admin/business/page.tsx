import { useState } from 'react';
import { supabase as getSupabase } from '@/lib/supabase/client';
import { hasPermission } from '@/lib/auth/permissions';
import { useLoad, invalidate } from '@/lib/useLoad';
import { featureVenue, grantPro, setSponsor } from '@/pages/_business/actions';
import { COLORS, RADIUS } from '@/lib/theme';

const card = { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, padding: '12px 14px' } as const;
const input = { background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: '9px 10px', fontSize: 14, fontFamily: 'inherit' } as const;
const btn = { background: COLORS.orange, color: '#0a0908', border: 'none', borderRadius: RADIUS.md, padding: '9px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer' } as const;
const ghost = { background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary, borderRadius: RADIUS.md, padding: '8px 12px', fontSize: 12.5, cursor: 'pointer' } as const;

type VenueOpt = { id: string; name: string; suburb: string; pro_until: string | null };
type Req = { id: string; note: string | null; created_at: string; venue: { id: string; slug: string; name: string; suburb: string } | null; profile: { username: string | null; email: string } | null };
type Spon = { id: string; brand: string; headline: string; end_date: string; impressions: number; clicks: number };
type Promo = { id: string; tier: string; end_date: string; total_impressions: number; total_clicks: number; venue: { name: string } | null };

async function load() {
  const sb = getSupabase();
  const allowed = await hasPermission('feature_venue');
  if (!allowed) return null;
  const monthStart = new Date(); monthStart.setDate(1);
  const from = new Date(monthStart.getTime() - monthStart.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [venues, reqs, promos, usage, sponsors] = await Promise.all([
    sb.from('venues').select('id, name, suburb, pro_until').eq('moderation_status', 'approved').is('deleted_at', null).order('name').limit(500),
    sb.from('pro_requests').select('id, note, created_at, venue:venues ( id, slug, name, suburb ), profile:profiles!pro_requests_user_id_fkey ( username, email )').eq('status', 'open').order('created_at'),
    sb.from('featured_venues').select('id, tier, end_date, total_impressions, total_clicks, venue:venues ( name )').is('deleted_at', null).gt('end_date', new Date().toISOString()).order('end_date'),
    /* every row of the month: one request stops at 1 000, and this table has a row per venue per day —
       so past about thirty busy venues the redemption sheet quietly under-counted (13 Nov 2026) */
    (async () => {
      const rows: unknown[] = [];
      for (let offset = 0; offset < 500_000; offset += 1000) {
        const page = await sb.from('venue_analytics').select('venue_id, profile_views, directions_taps, deal_claims, deal_redemptions')
          .gte('date', from).order('date', { ascending: true }).order('venue_id', { ascending: true }).range(offset, offset + 999);
        if (page.error) return { data: rows, error: page.error };
        rows.push(...(page.data ?? []));
        if (!page.data || page.data.length < 1000) break;
      }
      return { data: rows, error: null };
    })(),
    sb.from('sponsor_slots').select('id, brand, headline, end_date, impressions, clicks').is('deleted_at', null).gt('end_date', new Date().toISOString()),
  ]);
  const byVenue = new Map<string, { views: number; directions: number; claims: number; redeemed: number }>();
  for (const r of (usage.data ?? []) as { venue_id: string; profile_views: number; directions_taps: number; deal_claims: number; deal_redemptions: number }[]) {
    const e = byVenue.get(r.venue_id) ?? { views: 0, directions: 0, claims: 0, redeemed: 0 };
    e.views += r.profile_views; e.directions += r.directions_taps; e.claims += r.deal_claims; e.redeemed += r.deal_redemptions;
    byVenue.set(r.venue_id, e);
  }
  const venueList = (venues.data ?? []) as VenueOpt[];
  const names = new Map(venueList.map((v) => [v.id, v]));
  const sheet = [...byVenue].map(([id, u]) => ({ id, name: names.get(id)?.name ?? '—', ...u })).filter((r) => r.redeemed || r.claims).sort((a, b) => b.redeemed - a.redeemed);
  return { venues: venueList, reqs: (reqs.data ?? []) as unknown as Req[], promos: (promos.data ?? []) as unknown as Promo[], sponsors: (sponsors.data ?? []) as Spon[], sheet, from };
}

export default function AdminBusinessPage() {
  const { data, loading } = useLoad(load, []);
  const [msg, setMsg] = useState<string | null>(null);
  const [venue, setVenue] = useState('');
  const [days, setDays] = useState(90);
  const [note, setNote] = useState('');
  const [tier, setTier] = useState('bronze');
  const [promoDays, setPromoDays] = useState(7);
  const [sp, setSp] = useState({ brand: '', headline: '', body: '', link: 'https://', days: 7 });
  if (loading) return <p style={{ color: COLORS.textSecondary }}>Loading…</p>;
  if (!data) return <p style={{ color: COLORS.textSecondary }}>Only admins can see Business.</p>;
  const now = Date.now();

  async function grant(venueId: string, d: number, n: string) {
    const r = await grantPro(venueId, d, n);
    setMsg(r.ok ? (d === 0 ? 'Pro removed.' : `Pro until ${new Date(r.until).toLocaleDateString('en-AU')}.`) : r.error);
  }
  async function dismiss(id: string) {
    const { error } = await getSupabase().from('pro_requests').update({ status: 'dismissed' }).eq('id', id);
    setMsg(error ? error.message : 'Request dismissed.');
    invalidate();
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h1 style={{ fontSize: 24, margin: '12px 0 0' }}>Business</h1>
      {msg && <div role="status" style={{ ...card, borderColor: COLORS.orange, fontSize: 13 }}>{msg}</div>}

      <section>
        <h2 style={{ fontSize: 16 }}>Pro requests ({data.reqs.length})</h2>
        {data.reqs.length === 0 && <p style={{ color: COLORS.textSecondary, fontSize: 13 }}>None waiting.</p>}
        {data.reqs.map((r) => (
          <div key={r.id} style={{ ...card, marginBottom: 8 }}>
            <strong>{r.venue?.name}</strong> <span style={{ color: COLORS.textMuted }}>· {r.venue?.suburb}</span>
            <div style={{ color: COLORS.textSecondary, fontSize: 12.5 }}>@{r.profile?.username} · {r.profile?.email} · {r.created_at.slice(0, 10)}</div>
            {r.note && <div style={{ fontSize: 13, marginTop: 4 }}>“{r.note}”</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {r.venue && <button style={btn} onClick={() => grant(r.venue!.id, 30, 'Trial from request')}>Give 30-day trial</button>}
              {r.venue && <button style={btn} onClick={() => grant(r.venue!.id, 365, 'Paid — annual')}>Paid · 1 year</button>}
              <button style={ghost} onClick={() => dismiss(r.id)}>Dismiss</button>
            </div>
          </div>
        ))}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Grant or remove Pro</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select aria-label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} style={{ ...input, flex: 1, minWidth: 180 }}>
            <option value="">Pick a venue…</option>
            {data.venues.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.suburb}{v.pro_until && Date.parse(v.pro_until) > now ? ' (Pro)' : ''}</option>)}
          </select>
          <input aria-label="Days" type="number" min={0} max={730} value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ ...input, width: 80 }} />
          <input aria-label="Note" placeholder="Note (e.g. paid, invoice #)" value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input, flex: 1, minWidth: 140 }} />
          <button style={btn} disabled={!venue} onClick={() => grant(venue, days, note)}>{days === 0 ? 'Remove Pro' : `Add ${days} days`}</button>
        </div>
        <p style={{ color: COLORS.textMuted, fontSize: 12, margin: '6px 0 0' }}>Adds time on top of whatever they have. 0 days removes Pro now. Every change is audit-logged.</p>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Promote a venue</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select aria-label="Venue to promote" value={venue} onChange={(e) => setVenue(e.target.value)} style={{ ...input, flex: 1, minWidth: 180 }}>
            <option value="">Pick a venue…</option>
            {data.venues.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.suburb}</option>)}
          </select>
          <select aria-label="Tier" value={tier} onChange={(e) => setTier(e.target.value)} style={input}>
            <option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="platinum">Platinum</option>
          </select>
          <input aria-label="Promo days" type="number" min={1} max={365} value={promoDays} onChange={(e) => setPromoDays(Number(e.target.value))} style={{ ...input, width: 80 }} />
          <button style={btn} disabled={!venue} onClick={async () => { const r = await featureVenue(venue, tier, promoDays); setMsg(r.ok ? 'Promoted.' : r.error); }}>Promote</button>
        </div>
        <div style={{ marginTop: 10 }}>
          {data.promos.map((p) => (
            <div key={p.id} style={{ fontSize: 13, color: COLORS.textSecondary, padding: '4px 0' }}>
              <strong style={{ color: COLORS.text }}>{p.venue?.name}</strong> · {p.tier} · to {p.end_date.slice(0, 10)} · {p.total_impressions} shown · {p.total_clicks} taps
            </div>
          ))}
          {data.promos.length === 0 && <span style={{ color: COLORS.textMuted, fontSize: 13 }}>No live promotions.</span>}
        </div>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Smoko of the week (sponsor)</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input aria-label="Brand" placeholder="Brand" value={sp.brand} onChange={(e) => setSp({ ...sp, brand: e.target.value })} style={{ ...input, flex: 1, minWidth: 140 }} />
          <input aria-label="Headline" placeholder="Headline" value={sp.headline} onChange={(e) => setSp({ ...sp, headline: e.target.value })} style={{ ...input, flex: 2, minWidth: 180 }} />
          <input aria-label="Details" placeholder="Details (optional)" value={sp.body} onChange={(e) => setSp({ ...sp, body: e.target.value })} style={{ ...input, flex: '1 1 100%' }} />
          <input aria-label="Link" placeholder="https://…" value={sp.link} onChange={(e) => setSp({ ...sp, link: e.target.value })} style={{ ...input, flex: 1, minWidth: 180 }} />
          <input aria-label="Sponsor days" type="number" min={1} max={90} value={sp.days} onChange={(e) => setSp({ ...sp, days: Number(e.target.value) })} style={{ ...input, width: 80 }} />
          <button style={btn} disabled={!sp.brand || !sp.headline} onClick={async () => { const r = await setSponsor(sp.brand, sp.headline, sp.body, sp.link, sp.days); setMsg(r.ok ? 'Sponsor slot live.' : r.error); }}>Set</button>
        </div>
        <div style={{ marginTop: 10 }}>
          {data.sponsors.map((x) => (
            <div key={x.id} style={{ fontSize: 13, color: COLORS.textSecondary, padding: '4px 0' }}>
              <strong style={{ color: COLORS.text }}>{x.brand}</strong> · {x.headline} · to {x.end_date.slice(0, 10)} · {x.impressions} shown · {x.clicks} taps
            </div>
          ))}
          {data.sponsors.length === 0 && <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Slot is empty — nothing shows on the feed. A new sale ends the current one.</span>}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>Deal usage since {data.from}</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 0 }}>Redeemed = codes a venue confirmed at the counter. This is the number to bill a per-redemption fee from.</p>
        {data.sheet.length === 0 && <p style={{ color: COLORS.textSecondary, fontSize: 13 }}>No deal activity yet.</p>}
        {data.sheet.map((r) => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13.5 }}>
            <span>{r.name}</span>
            <span style={{ color: COLORS.textSecondary }}>{r.claims} codes · <strong style={{ color: COLORS.text }}>{r.redeemed} redeemed</strong> · {r.directions} directions</span>
          </div>
        ))}
      </section>
    </div>
  );
}
