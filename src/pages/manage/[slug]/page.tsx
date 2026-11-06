import { useEffect, useState } from 'react';
import { Link } from '@/lib/nav';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useLoad } from '@/lib/useLoad';
import { getVenueBySlug } from '@/lib/queries/venues';
import { getReviewsByVenueId } from '@/lib/queries/reviews';
import {
  dealBadge, getDealsForOwner, getManagedVenues, getRepliesByReviewIds, getVenueStats, type VenueStats,
} from '@/lib/queries/business';
import { ReplyBox } from '../../_business/ReplyBox';
import { createDeal, endDeal, redeemDealCode, requestPro, saveVenueDetails } from '../../_business/actions';
import { billingEnabled, openBillingPortal, startCheckout } from '@/lib/api/billing';
import { isNative } from '@/lib/bio';
import { FREE_DEAL_LIMIT, PRO_DEAL_LIMIT, PRO_PRICE_TEXT } from '@/config/plans';
import { COLORS, RADIUS } from '@/lib/theme';
import NotFound from '../../not-found';
import { uploadPhoto, photoUrl } from '@/lib/photos';
import { supabase as getSupabase } from '@/lib/supabase/client';
import { invalidate } from '@/lib/useLoad';
import { VenueQr } from '@/components/VenueQr';

const card = { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, padding: '14px 16px' } as const;
const input = { background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' } as const;
const primary = { background: COLORS.orange, color: '#0a0908', border: 'none', borderRadius: RADIUS.md, padding: '10px 16px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' } as const;
const mono = { fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' } as const;

async function load(slug: string, userId: string | null) {
  const venue = await getVenueBySlug(slug);
  if (!venue || !userId) return { venue, managed: false as const };
  const managed = (await getManagedVenues(userId)).some((v) => v.id === venue.id);
  if (!managed) return { venue, managed: false as const };
  const [deals, reviews] = await Promise.all([getDealsForOwner(venue.id), getReviewsByVenueId(venue.id, 30)]);
  const replies = await getRepliesByReviewIds(reviews.map((r) => r.id));
  return { venue, managed: true as const, deals, reviews, replies };
}

function Tile({ label, value, locked }: { label: string; value: number | string | null; locked?: boolean }) {
  return (
    <div style={{ ...card, padding: '10px 12px', opacity: locked ? 0.6 : 1 }}>
      <div style={{ ...mono, fontSize: 10, color: COLORS.textMuted }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: locked ? COLORS.textMuted : COLORS.text }}>{locked ? 'Pro' : value}</div>
    </div>
  );
}

function Bars({ daily }: { daily: VenueStats['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.views));
  const w = 100 / Math.max(1, daily.length);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label="Views per day" style={{ width: '100%', height: 56, display: 'block' }}>
      {daily.map((d, i) => {
        const h = (d.views / max) * 28;
        return <rect key={d.date} x={i * w + w * 0.15} y={30 - h} width={w * 0.7} height={Math.max(h, 0.5)} fill={COLORS.orange} opacity={d.views ? 1 : 0.25} />;
      })}
    </svg>
  );
}

function Stats({ venueId }: { venueId: string }) {
  const [days, setDays] = useState(7);
  const { data, loading } = useLoad(() => getVenueStats(venueId, days), [venueId, days]);
  const pro = data?.pro ?? false;
  return (
    <section className="section">
      <div className="section-title"><h2>How it&apos;s going</h2></div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[7, 30, 90].map((d) => {
          const locked = !pro && d > 7 && data != null;
          return (
            <button key={d} type="button" disabled={locked} onClick={() => setDays(d)}
              style={{ ...mono, fontSize: 11, padding: '6px 12px', borderRadius: 999, cursor: locked ? 'not-allowed' : 'pointer',
                border: `1.5px solid ${days === d ? COLORS.orange : COLORS.border}`, background: days === d ? COLORS.orange : COLORS.surface,
                color: days === d ? '#0a0908' : locked ? COLORS.textMuted : COLORS.text }}>
              {d} days{locked ? ' · Pro' : ''}
            </button>
          );
        })}
      </div>
      {loading && !data ? <p style={{ color: COLORS.textSecondary }}>Loading…</p> : !data ? <p style={{ color: COLORS.red }}>Couldn&apos;t load stats.</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Tile label="Views" value={data.views} />
            <Tile label="Saves" value={data.saves} />
            <Tile label="New reviews" value={data.new_reviews} />
            <Tile label="Directions" value={data.directions} locked={!data.pro} />
            <Tile label="Calls" value={data.calls} locked={!data.pro} />
            <Tile label="Shares" value={data.shares} locked={!data.pro} />
            <Tile label="Codes issued" value={data.deal_claims} locked={!data.pro} />
            <Tile label="Redeemed" value={data.deal_redemptions} locked={!data.pro} />
            <Tile label="Rating" value={data.review_count ? Number(data.rating).toFixed(1) : '—'} />
          </div>
          <div style={{ ...card, marginTop: 8 }}><Bars daily={data.daily} /></div>
          <p style={{ color: COLORS.textMuted, fontSize: 12, margin: '6px 0 0' }}>
            {data.saves_total} {data.saves_total === 1 ? 'tradie has' : 'tradies have'} saved {`this spot`} in total.
            {!data.pro && ' Pro shows Directions, Calls, Shares and deal numbers, and goes back 90 days.'}
          </p>
        </>
      )}
    </section>
  );
}

function Redeem({ venueId }: { venueId: string }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await redeemDealCode(venueId, code);
    setBusy(false);
    if (res.ok) { setMsg({ ok: true, text: `✓ ${res.deal} — for @${res.customer}. Serve them.` }); setCode(''); }
    else setMsg({ ok: false, text: res.error });
  }
  return (
    <section className="section">
      <div className="section-title"><h2>Check a code</h2></div>
      <form onSubmit={go} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 13 }}>A customer shows a code like GS-7KQ2. Type it here to confirm and use it up.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input aria-label="Deal code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="GS-XXXX" autoCapitalize="characters" autoComplete="off" style={{ ...input, ...mono, fontSize: 16 }} />
          <button type="submit" disabled={busy} style={{ ...primary, opacity: busy ? 0.7 : 1 }}>{busy ? '…' : 'Check'}</button>
        </div>
        {msg && <p role="status" style={{ margin: 0, fontWeight: 700, fontSize: 13.5, color: msg.ok ? COLORS.hiVisGreen : COLORS.red }}>{msg.text}</p>}
      </form>
    </section>
  );
}

function Deals({ venueId, pro, deals }: { venueId: string; pro: boolean; deals: Awaited<ReturnType<typeof getDealsForOwner>> }) {
  const now = Date.now();
  const live = deals.filter((d) => Date.parse(d.end_date) > now);
  const limit = pro ? PRO_DEAL_LIMIT : FREE_DEAL_LIMIT;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', description: '', terms: '', kind: 'other' as 'percent' | 'amount' | 'other', value: 10, hours: 24 * 7, max: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await createDeal({ venueId, title: f.title, description: f.description, terms: f.terms, kind: f.kind, value: Number(f.value), hours: f.hours, maxRedemptions: f.max ? Number(f.max) : null });
    setBusy(false);
    if (res.ok) { setOpen(false); setF({ ...f, title: '', description: '', terms: '' }); } else setErr(res.error);
  }

  return (
    <section className="section">
      <div className="section-title"><h2>Deals</h2><span className="mono-chip">{live.length}/{limit} live</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {deals.slice(0, 8).map((d) => {
          const isLive = Date.parse(d.end_date) > now;
          return (
            <div key={d.id} style={{ ...card, opacity: isLive ? 1 : 0.6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong style={{ color: COLORS.orange, ...mono, fontSize: 11 }}>{dealBadge(d)}</strong>
                <span style={{ color: COLORS.text, fontWeight: 700, flex: 1 }}>{d.title}</span>
                {isLive && <button type="button" onClick={() => endDeal(d.id)} style={{ background: 'none', border: 'none', color: COLORS.textMuted, textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>End</button>}
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4 }}>
                {isLive ? `Ends ${new Date(d.end_date).toLocaleString('en-AU', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Finished'} · {d.claimed_count} codes · {d.redeemed_count} redeemed
              </div>
            </div>
          );
        })}
        {!open && (
          <button type="button" onClick={() => setOpen(true)} style={{ ...primary, alignSelf: 'flex-start' }}>
            {live.length >= limit ? (pro ? 'Deal limit reached' : 'Add another (needs Pro)') : 'Post a deal'}
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <input aria-label="Title" placeholder="Pie + coffee $8 before 7am" maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={input} required />
          <input aria-label="Details" placeholder="Details (optional)" maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={input} />
          <input aria-label="Terms" placeholder="Terms, e.g. one per customer (optional)" maxLength={200} value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} style={input} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select aria-label="Discount type" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })} style={input}>
              <option value="other">Special price / freebie</option>
              <option value="percent">% off</option>
              <option value="amount">$ off</option>
            </select>
            {f.kind !== 'other' && <input aria-label="Amount" type="number" min={1} step={f.kind === 'amount' ? 0.5 : 1} value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} style={{ ...input, width: 90 }} />}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select aria-label="Runs for" value={f.hours} onChange={(e) => setF({ ...f, hours: Number(e.target.value) })} style={input}>
              <option value={4}>Runs 4 hours</option><option value={24}>Runs 1 day</option><option value={24 * 7}>Runs 1 week</option><option value={24 * 30}>Runs 30 days</option>
            </select>
            <input aria-label="Limit" type="number" min={1} placeholder="Limit (optional)" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} style={input} />
          </div>
          {err && <p role="alert" style={{ margin: 0, color: COLORS.red, fontSize: 13 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy} style={{ ...primary, opacity: busy ? 0.7 : 1 }}>{busy ? 'Posting…' : 'Post deal'}</button>
            <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: COLORS.textSecondary, cursor: 'pointer' }}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

function Details({ venue }: { venue: NonNullable<Awaited<ReturnType<typeof load>>['venue']> }) {
  const [f, setF] = useState({ tagline: venue.tagline, description: venue.description, phone: venue.phone ?? '', opens_at: venue.opens_at, closes_at: venue.closes_at });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await saveVenueDetails(venue.id, f);
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: res.error });
  }
  return (
    <section className="section">
      <div className="section-title"><h2>Your listing</h2></div>
      <form onSubmit={save} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input aria-label="Tagline" placeholder="One line that sells it" maxLength={120} value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} style={input} />
        <textarea aria-label="About" rows={3} maxLength={600} placeholder="About the place" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ ...input, resize: 'vertical' }} />
        <input aria-label="Phone" type="tel" placeholder="Phone (shows a Call button)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} style={input} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input aria-label="Opens" type="time" value={f.opens_at} onChange={(e) => setF({ ...f, opens_at: e.target.value })} style={input} />
          <input aria-label="Closes" type="time" value={f.closes_at} onChange={(e) => setF({ ...f, closes_at: e.target.value })} style={input} />
        </div>
        <button type="submit" disabled={busy} style={{ ...primary, alignSelf: 'flex-start', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
        {msg && <p role="status" style={{ margin: 0, color: msg.ok ? COLORS.hiVisGreen : COLORS.red, fontSize: 13 }}>{msg.text}</p>}
      </form>
    </section>
  );
}

function Plan({ venueId, pro, until }: { venueId: string; pro: boolean; until: string | null }) {
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | string>('idle');
  const [busy, setBusy] = useState(false);
  // Card payment is web only (the app never takes payment itself) and only once Stripe is switched on.
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (isNative()) return;
    let live = true;
    billingEnabled().then((on) => { if (live) setOnline(on); });
    return () => { live = false; };
  }, []);
  async function pay(kind: 'checkout' | 'portal') {
    setBusy(true);
    setState('idle');
    const res = await (kind === 'checkout' ? startCheckout : openBillingPortal)(venueId);
    if (res.ok) { window.location.assign(res.url); return; }
    setBusy(false);
    setState(res.error);
  }
  async function ask() {
    setBusy(true);
    const res = await requestPro(venueId, note);
    setBusy(false);
    setState(res.ok ? 'sent' : res.error);
  }
  return (
    <section className="section">
      <div className="section-title"><h2>Plan</h2></div>
      <div style={{ ...card, borderColor: pro ? COLORS.orange : COLORS.border }}>
        {pro ? (
          <>
          <p style={{ margin: 0, color: COLORS.hiVisGreen, fontWeight: 800 }}>
            Pro{until ? ` until ${new Date(until).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
          </p>
          {online && (
            <>
              <button type="button" onClick={() => pay('portal')} disabled={busy} style={{ ...primary, marginTop: 10, opacity: busy ? 0.7 : 1 }}>Manage billing</button>
              {state !== 'idle' && state !== 'sent' && <p role="alert" style={{ margin: '8px 0 0', color: COLORS.red, fontSize: 13 }}>{state}</p>}
            </>
          )}
          </>
        ) : (
          <>
            <p style={{ margin: 0, color: COLORS.text, fontWeight: 800 }}>Free{PRO_PRICE_TEXT && !isNative() ? '' : ' — Pro is open by invitation'}</p>
            <ul style={{ margin: '8px 0', paddingLeft: 18, color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 1.6 }}>
              <li>Up to {PRO_DEAL_LIMIT} deals at once (free: {FREE_DEAL_LIMIT})</li>
              <li>See Directions, Calls, Shares and deal redemptions</li>
              <li>90 days of history (free: 7)</li>
            </ul>
            {PRO_PRICE_TEXT && !isNative() && <p style={{ margin: '0 0 8px', color: COLORS.orange, fontWeight: 800 }}>{PRO_PRICE_TEXT}</p>}
            {online && (
              <button type="button" onClick={() => pay('checkout')} disabled={busy} style={{ ...primary, alignSelf: 'flex-start', marginBottom: 10, opacity: busy ? 0.7 : 1 }}>
                {busy ? 'Opening…' : 'Go Pro'}
              </button>
            )}
            {state === 'sent' ? (
              <p role="status" style={{ margin: 0, color: COLORS.hiVisGreen, fontWeight: 700, fontSize: 13.5 }}>Got it — we&apos;ll be in touch about Pro.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input aria-label="Note" placeholder="Anything we should know? (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} style={input} />
                <button type="button" onClick={ask} disabled={busy} style={{ ...primary, alignSelf: 'flex-start', opacity: busy ? 0.7 : 1 }}>{busy ? 'Sending…' : 'Ask for Pro'}</button>
                {state !== 'idle' && <p role="alert" style={{ margin: 0, color: COLORS.red, fontSize: 13 }}>{state}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

type OwnPhoto = { id: string; path: string; moderation_status: string };

/** Venue photos: up to 6, each held for a moderator before it shows on the venue page. */
function OwnerPhotos({ venueId, userId }: { venueId: string; userId: string }) {
  const { data, reload } = useLoad(async (): Promise<OwnPhoto[]> => {
    const { data: rows, error } = await getSupabase().from('photos')
      .select('id, path, moderation_status').eq('venue_id', venueId).is('review_id', null).is('deleted_at', null).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as OwnPhoto[];
  }, [venueId]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    try {
      for (const f of Array.from(files)) await uploadPhoto(userId, venueId, null, f);
      setMsg({ ok: true, text: 'Uploaded. A moderator checks it before it shows.' });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Upload failed.' }); }
    setBusy(false); reload(); invalidate();
  }
  async function remove(p: OwnPhoto) {
    const { error } = await getSupabase().from('photos').delete().eq('id', p.id);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    await getSupabase().storage.from('gossoko-photos').remove([p.path]);
    reload(); invalidate();
  }
  return (
    <section className="section">
      <div className="section-title"><h2>Photos</h2><span className="mono-chip">{data?.length ?? 0}/6</span></div>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(data ?? []).map((p) => (
            <figure key={p.id} style={{ margin: 0, position: 'relative' }}>
              <img src={photoUrl(p.path)} alt="" style={{ height: 84, width: 112, objectFit: 'cover', borderRadius: 8, opacity: p.moderation_status === 'approved' ? 1 : 0.55 }} />
              <figcaption style={{ ...mono, fontSize: 9.5, color: COLORS.textMuted }}>{p.moderation_status === 'approved' ? 'Live' : p.moderation_status === 'pending' ? 'Waiting' : 'Rejected'}</figcaption>
              <button type="button" aria-label="Remove photo" onClick={() => remove(p)} style={{ position: 'absolute', top: 2, right: 2, background: '#000a', color: '#fff', border: 'none', borderRadius: 999, width: 22, height: 22, cursor: 'pointer' }}>×</button>
            </figure>
          ))}
        </div>
        <input type="file" accept="image/*" multiple disabled={busy || (data?.length ?? 0) >= 6} onChange={(e) => { void add(e.target.files); e.target.value = ''; }} style={{ color: COLORS.text }} />
        {busy && <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 13 }}>Uploading…</p>}
        {msg && <p role="status" style={{ margin: 0, color: msg.ok ? COLORS.hiVisGreen : COLORS.red, fontSize: 13 }}>{msg.text}</p>}
      </div>
    </section>
  );
}

export default function ManageVenuePage() {
  const { slug = '' } = useParams();
  const { user, status } = useAuth();
  const { data, loading } = useLoad(() => load(slug, user?.id ?? null), [slug, user?.id]);
  if (status !== 'loading' && !user) return <Navigate to={`/login?next=${encodeURIComponent(`/manage/${slug}`)}`} replace />;
  if ((loading && !data) || status === 'loading') return <p style={{ color: COLORS.textSecondary, padding: 16 }}>Loading…</p>;
  if (!data || !data.venue) return <NotFound />;
  const { venue } = data;
  if (!data.managed) {
    return (
      <section className="section">
        <p style={{ color: COLORS.textSecondary, lineHeight: 1.55 }}>
          Only a verified owner can manage {venue.name}. <Link href={`/venue/${venue.slug}`} style={{ color: COLORS.orange }}>Back to the venue</Link>
        </p>
      </section>
    );
  }
  return (
    <>
      <header className="top-bar">
        <div>
          <h1 style={{ textTransform: 'uppercase' }}>{venue.name}</h1>
          <p className="top-bar__sub">Your dashboard · <Link href={`/venue/${venue.slug}`} style={{ color: COLORS.orange }}>see it as a customer</Link></p>
        </div>
      </header>
      <Stats venueId={venue.id} />
      <Redeem venueId={venue.id} />
      <Deals venueId={venue.id} pro={venue.pro} deals={data.deals} />
      {user && <OwnerPhotos venueId={venue.id} userId={user.id} />}
      <section className="section">
        <div className="section-title"><h2>Reviews</h2></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.reviews.length === 0 && <p style={{ color: COLORS.textSecondary }}>No reviews yet.</p>}
          {data.reviews.slice(0, 6).map((r) => (
            <div key={r.id} style={card}>
              <div style={{ color: COLORS.text, fontWeight: 700 }}>@{r.user.username} · ★ {r.overall.toFixed(1)}</div>
              <div style={{ color: COLORS.textSecondary, fontSize: 13.5, marginTop: 2 }}>{r.title} — {r.body}</div>
              <ReplyBox reviewId={r.id} reply={data.replies.get(r.id)} venueName={venue.name} isOwner />
            </div>
          ))}
        </div>
      </section>
      <VenueQr slug={venue.slug} name={venue.name} />
      <Details venue={venue} />
      <Plan venueId={venue.id} pro={venue.pro} until={venue.pro_until} />
      <div className="hazard-strip" style={{ marginTop: 28 }} />
    </>
  );
}
