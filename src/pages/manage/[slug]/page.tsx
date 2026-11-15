import { useEffect, useRef, useState } from 'react';
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
import { createDeal, endDeal, MAX_SCHEDULE_DAYS, redeemDealCode, requestPro, saveVenueDetails, saveWeekHours } from '../../_business/actions';
import { hoursOn, WEEK_ORDER, WEEKDAY_NAMES } from '@/lib/hours';
import { scheduleSupported } from '@/lib/queries/dealSchema';
import { CLOCK_SKEW_MS, brisbaneLocalToIso, daysLabel, dealState, isoToBrisbaneLocal, WEEKDAYS, type DealState } from '@/lib/deals';
import { billingEnabled, openBillingPortal, startCheckout } from '@/lib/api/billing';
import { isNative } from '@/lib/bio';
import { FREE_DEAL_LIMIT, PRO_DEAL_LIMIT, PRO_PRICE_TEXT } from '@/config/plans';
import { COLORS, RADIUS, BRAND_GRADIENT } from '@/lib/theme';
import NotFound from '../../not-found';
import { uploadPhoto, photoUrl } from '@/lib/photos';
import { supabase as getSupabase } from '@/lib/supabase/client';
import { invalidate } from '@/lib/useLoad';
import { VenueQr } from '@/components/VenueQr';
import { PhotoPicker } from '@/components/PhotoPicker';
import { chartEmpty, dayBars } from '@/lib/chart';
import { keepScroll } from '@/lib/keepScroll';
import { geocodeAddress } from '@/lib/geocode';

const card = { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, padding: '14px 16px' } as const;
const input = { background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' } as const;
const primary = { background: BRAND_GRADIENT, color: '#0a0908', border: 'none', borderRadius: RADIUS.md, padding: '10px 16px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' } as const;
const mono = { fontFamily: 'var(--font-label)', letterSpacing: '0.08em', textTransform: 'uppercase' } as const;

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

/** Views per day: a labelled bar per day (weekday for a week, date for longer), the count above each bar. */
function Bars({ daily, days }: { daily: VenueStats['daily']; days: number }) {
  if (chartEmpty(daily)) {
    return (
      <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', padding: '18px 8px' }}>
        No views in the last {days} days yet. Share your QR code or post a deal to get tradies looking.
      </p>
    );
  }
  const bars = dayBars(daily);
  const dense = bars.length > 14;
  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ ...mono, fontSize: 10, color: COLORS.textMuted, marginBottom: 6 }}>Views per day</figcaption>
      <div role="img" aria-label={`Views per day: ${bars.map((b) => `${b.date} ${b.value}`).join(', ')}`}
        style={{ display: 'flex', alignItems: 'flex-end', gap: dense ? 1 : 6, height: 110 }}>
        {bars.map((b) => (
          <div key={b.date} title={`${b.date}: ${b.value} views`} style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
            {!dense && <span style={{ fontSize: 11, fontWeight: 700, color: b.value ? COLORS.text : COLORS.textMuted, marginBottom: 2 }}>{b.value}</span>}
            <div style={{ width: '100%', maxWidth: 36, height: `${Math.max(b.pct, b.value ? 4 : 2)}%`, background: b.value ? COLORS.orange : COLORS.border, borderRadius: '3px 3px 0 0' }} />
          </div>
        ))}
      </div>
      <div aria-hidden style={{ display: 'flex', gap: dense ? 1 : 6, borderTop: `1px solid ${COLORS.border}`, paddingTop: 4 }}>
        {bars.map((b) => (
          <span key={b.date} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 10, color: COLORS.textMuted, whiteSpace: 'nowrap', overflow: 'visible' }}>{b.label}</span>
        ))}
      </div>
      {dense && <p style={{ margin: '4px 0 0', fontSize: 11, color: COLORS.textMuted }}>Busiest day: {Math.max(...bars.map((b) => b.value))} views</p>}
    </figure>
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
          <div style={{ ...card, marginTop: 8 }}><Bars daily={data.daily} days={data.days ?? days} /></div>
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
  const inFlight = useRef(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    // The button isn't disabled while checking (that drops focus and closes the phone keyboard);
    // a ref stops a double tap. keepScroll holds the page where it was while the check refreshes it.
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await keepScroll(() => redeemDealCode(venueId, code));
      if (res.ok) { setMsg({ ok: true, text: `✓ ${res.deal} — for @${res.customer}. Serve them.` }); setCode(''); }
      else setMsg({ ok: false, text: res.error });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="section">
      <div className="section-title"><h2>Check a code</h2></div>
      <form onSubmit={go} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 13 }}>A customer shows a code like GS-7KQ2. Type it here to confirm and use it up.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input aria-label="Deal code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="GS-XXXX" autoCapitalize="characters" autoComplete="off" style={{ ...input, ...mono, fontSize: 16 }} />
          <button type="submit" aria-busy={busy} style={{ ...primary, opacity: busy ? 0.7 : 1 }}>{busy ? '…' : 'Check'}</button>
        </div>
        {msg && <p role="status" style={{ margin: 0, fontWeight: 700, fontSize: 13.5, color: msg.ok ? COLORS.green : COLORS.red }}>{msg.text}</p>}
      </form>
    </section>
  );
}

function dealWhen(d: { start_date: string; end_date: string; days_of_week: number[] | null; deleted_at?: string | null }, state: DealState): string {
  const at = (iso: string) => new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const days = d.days_of_week?.length ? ` · ${daysLabel(d.days_of_week)}` : '';
  if (state === 'finished') return d.deleted_at ? (Date.parse(d.deleted_at) < Date.parse(d.start_date) ? 'Cancelled' : `Ended ${at(d.deleted_at)}`) : 'Finished';
  if (state === 'scheduled') return `Starts ${at(d.start_date)} · ends ${at(d.end_date)}${days}`;
  if (state === 'not-today') return `Not today${days} · ends ${at(d.end_date)}`;
  return `Live · ends ${at(d.end_date)}${days}`;
}

const blankDeal = { title: '', description: '', terms: '', kind: 'other' as 'percent' | 'amount' | 'other', value: 10, hours: 24 * 7, max: '', start: '', days: [] as number[] };

function Deals({ venueId, pro, deals }: { venueId: string; pro: boolean; deals: Awaited<ReturnType<typeof getDealsForOwner>> }) {
  const now = Date.now();
  const states = new Map(deals.map((d) => [d.id, dealState(d, now, CLOCK_SKEW_MS)] as const));
  // "One deal at a time" = one LIVE at a time; scheduled deals wait their turn.
  const live = deals.filter((d) => states.get(d.id) === 'live');
  const upcoming = deals.filter((d) => states.get(d.id) === 'scheduled' || states.get(d.id) === 'not-today');
  const limit = pro ? PRO_DEAL_LIMIT : FREE_DEAL_LIMIT;
  // Weekdays + booking the next deal while one is live need migration 20261115000003. Until it's on the
  // database, the controls that would fail are hidden (the deal list itself loaded without them).
  const scheduling = scheduleSupported() !== false;
  const full = live.length >= limit;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blankDeal);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState<string | null>(null);
  const [endErr, setEndErr] = useState<{ id: string; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const startsAt = f.start ? brisbaneLocalToIso(f.start) : null;
    if (f.start && !startsAt) { setErr('Pick a start date and time.'); return; }
    setBusy(true);
    setErr(null);
    const res = await createDeal({ venueId, title: f.title, description: f.description, terms: f.terms, kind: f.kind, value: Number(f.value), hours: f.hours, maxRedemptions: f.max ? Number(f.max) : null, startsAt, days: f.days });
    setBusy(false);
    if (res.ok) { setOpen(false); setF(blankDeal); } else setErr(res.error);
  }

  async function end(id: string) {
    setEnding(id);
    setEndErr(null);
    const res = await endDeal(id);
    setEnding(null);
    // Success: endDeal refreshes the page's data (the row moves to Finished). Failure: say why, on the row.
    if (!res.ok) setEndErr({ id, text: res.error });
  }

  const toggleDay = (n: number) => setF({ ...f, days: f.days.includes(n) ? f.days.filter((x) => x !== n) : [...f.days, n] });

  return (
    <section className="section">
      <div className="section-title"><h2>Deals</h2><span className="mono-chip">{live.length}/{limit} live{upcoming.length ? ` · ${upcoming.length} coming up` : ''}</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {deals.slice(0, 8).map((d) => {
          const state = states.get(d.id) ?? 'finished';
          const active = state !== 'finished';
          return (
            <div key={d.id} style={{ ...card, opacity: active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong style={{ color: COLORS.orange, ...mono, fontSize: 11 }}>{dealBadge(d)}</strong>
                <span style={{ color: COLORS.text, fontWeight: 700, flex: 1 }}>{d.title}</span>
                {active && (
                  <button type="button" onClick={() => end(d.id)} disabled={ending === d.id}
                    style={{ background: 'none', border: 'none', color: COLORS.textMuted, textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>
                    {ending === d.id ? 'Ending…' : state === 'scheduled' ? 'Cancel' : 'End'}
                  </button>
                )}
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4 }}>
                {dealWhen(d, state)}
                {/* Deal numbers are a Pro feature (business page: "Deal codes issued and redeemed"), same as the tiles above. */}
                {pro ? ` · ${d.claimed_count} codes · ${d.redeemed_count} redeemed` : ''}
              </div>
              {endErr?.id === d.id && <p role="alert" style={{ margin: '6px 0 0', color: COLORS.red, fontSize: 13 }}>{endErr.text}</p>}
            </div>
          );
        })}
        {!pro && deals.length > 0 && <p style={{ margin: 0, color: COLORS.textMuted, fontSize: 12 }}>Pro shows how many codes each deal issued and how many were used.</p>}
        {!open && (
          <button type="button" onClick={() => setOpen(true)} style={{ ...primary, alignSelf: 'flex-start' }}>
            {full ? (scheduling ? 'Schedule the next deal' : pro ? 'Deal limit reached' : 'Add another (needs Pro)') : 'Post a deal'}
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
          {!scheduling && (
            <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 12.5 }}>Scheduling needs an update: picking weekdays{pro ? '' : ' and a later start date'} will work once it&apos;s live. This deal starts now.</p>
          )}
          {(scheduling || pro) && <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: COLORS.textSecondary }}>
            Starts (leave empty to start now)
            <input aria-label="Starts" type="datetime-local" value={f.start} min={isoToBrisbaneLocal(now)} max={isoToBrisbaneLocal(now + MAX_SCHEDULE_DAYS * 86400_000)}
              onChange={(e) => setF({ ...f, start: e.target.value })} style={input} />
          </label>}
          {scheduling && <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>Runs on {f.days.length === 0 ? '(every day)' : daysLabel(f.days)}</legend>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {WEEKDAYS.map((w) => {
                const on = f.days.includes(w.value);
                return (
                  <button key={w.value} type="button" aria-pressed={on} onClick={() => toggleDay(w.value)}
                    style={{ ...mono, fontSize: 11, padding: '6px 10px', borderRadius: 999, cursor: 'pointer', border: `1.5px solid ${on ? COLORS.orange : COLORS.border}`, background: on ? COLORS.orange : COLORS.surface, color: on ? '#0a0908' : COLORS.text }}>
                    {w.label}
                  </button>
                );
              })}
            </div>
          </fieldset>}
          <div style={{ display: 'flex', gap: 8 }}>
            <select aria-label="Runs for" value={f.hours} onChange={(e) => setF({ ...f, hours: Number(e.target.value) })} style={input}>
              <option value={4}>Runs 4 hours</option><option value={24}>Runs 1 day</option><option value={24 * 7}>Runs 1 week</option><option value={24 * 14}>Runs 2 weeks</option><option value={24 * 30}>Runs 30 days</option><option value={24 * 60}>Runs 60 days</option>
            </select>
            <input aria-label="Limit" type="number" min={1} placeholder="Limit (optional)" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} style={input} />
          </div>
          {!pro && full && scheduling && (
            <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 12.5 }}>Free runs one deal at a time: start this one after your live deal ends, or on other days.</p>
          )}
          {err && <p role="alert" style={{ margin: 0, color: COLORS.red, fontSize: 13 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy} style={{ ...primary, opacity: busy ? 0.7 : 1 }}>{busy ? 'Posting…' : f.start ? 'Schedule deal' : 'Post deal'}</button>
            <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: COLORS.textSecondary, cursor: 'pointer' }}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

function Details({ venue }: { venue: NonNullable<Awaited<ReturnType<typeof load>>['venue']> }) {
  const [f, setF] = useState({
    name: venue.name, address: venue.address ?? '', suburb: venue.suburb, postcode: venue.postcode ?? '',
    tagline: venue.tagline, description: venue.description, phone: venue.phone ?? '', opens_at: venue.opens_at, closes_at: venue.closes_at,
  });
  // Weekday hours (Peta, 15 Nov 2026): off = the usual hours every day.
  const [byDay, setByDay] = useState(Boolean(venue.week?.length));
  const [days, setDays] = useState(() => WEEK_ORDER.map((d) => {
    const h = hoursOn(d, venue.week, venue.opens_at, venue.closes_at);
    return { day: d, opens: h.opens.slice(0, 5), closes: h.closes.slice(0, 5), closed: h.closed };
  }));
  const setDay = (i: number, patch: Partial<(typeof days)[number]>) => setDays(days.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  // A new map position from Find on map / this phone's location; null = keep the current pin.
  const [pin, setPin] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const placeEdits = scheduleSupported() === true;
  const placeChanged = placeEdits && (f.name.trim() !== venue.name || f.address.trim() !== (venue.address ?? '') || f.suburb.trim() !== venue.suburb
    || f.postcode.trim() !== (venue.postcode ?? '') || pin !== null);
  const addressChanged = placeEdits && (f.address.trim() !== (venue.address ?? '') || f.suburb.trim() !== venue.suburb);

  async function findOnMap() {
    setLocating(true); setMsg(null);
    const r = await geocodeAddress({ address: f.address, suburb: f.suburb, postcode: f.postcode });
    setLocating(false);
    if (r.ok) setPin(r.hit); else setMsg({ ok: false, text: r.error });
  }
  function useHere() {
    if (!navigator.geolocation) { setMsg({ ok: false, text: 'This device can\'t share its location.' }); return; }
    setLocating(true); setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); setPin({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'This phone\'s location' }); },
      (e) => { setLocating(false); setMsg({ ok: false, text: `Couldn't get your location: ${e.message}` }); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    // A moved address needs a matching pin, or Nearby and Directions send tradies to the old spot.
    if (addressChanged && !pin) { setMsg({ ok: false, text: 'The address changed: tap Find on map (or use this phone\'s location at the venue) so the pin moves too.' }); return; }
    setBusy(true);
    let res = await saveVenueDetails(venue.id, {
      tagline: f.tagline, description: f.description, phone: f.phone, opens_at: f.opens_at, closes_at: f.closes_at,
      ...(placeChanged ? { name: f.name, address: f.address, suburb: f.suburb, postcode: f.postcode } : {}),
      ...(pin ? { latitude: pin.lat, longitude: pin.lng } : {}),
    });
    // Weekday hours: only call when there is something to set or clear (keeps a plain details save
    // working on a database without set_venue_hours yet).
    if (res.ok && (byDay || venue.week?.length)) res = await saveWeekHours(venue.id, byDay ? days : []);
    setBusy(false);
    if (res.ok) setPin(null);
    setMsg(res.ok
      ? { ok: true, text: 'Saved.' }
      : { ok: false, text: res.error });
  }
  const small = { fontSize: 12, color: COLORS.textSecondary } as const;
  const ghost = { background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: '8px 12px', fontSize: 13, cursor: 'pointer' } as const;
  return (
    <section className="section">
      <div className="section-title"><h2>Your listing</h2></div>
      <form onSubmit={save} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Name/address edits need migration 20261115000003 (staff alert + SEQ bound); hidden until it's live. */}
        {placeEdits && (<>
        <input aria-label="Venue name" placeholder="Venue name" maxLength={80} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={input} />
        <input aria-label="Street address" placeholder="Street address" maxLength={200} required value={f.address} onChange={(e) => { setF({ ...f, address: e.target.value }); setPin(null); }} style={input} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input aria-label="Suburb" placeholder="Suburb" maxLength={80} required value={f.suburb} onChange={(e) => { setF({ ...f, suburb: e.target.value }); setPin(null); }} style={input} />
          <input aria-label="Postcode" placeholder="Postcode" inputMode="numeric" maxLength={4} value={f.postcode} onChange={(e) => setF({ ...f, postcode: e.target.value })} style={{ ...input, width: 110 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={findOnMap} disabled={locating} style={ghost}>{locating ? 'Looking…' : 'Find on map'}</button>
          <button type="button" onClick={useHere} disabled={locating} style={ghost}>Use this phone&apos;s location</button>
          <span style={small}>
            {pin ? `New pin: ${pin.label.split(',').slice(0, 3).join(',')} (${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)})` : `Pin: ${venue.lat.toFixed(5)}, ${venue.lng.toFixed(5)}`}
          </span>
        </div>
        {placeChanged && <p style={{ ...small, margin: 0 }}>A new name or address goes live straight away, and our team gets a note to check it.</p>}
        </>)}
        <input aria-label="Tagline" placeholder="One line that sells it" maxLength={120} value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} style={input} />
        <textarea aria-label="About" rows={3} maxLength={600} placeholder="About the place" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ ...input, resize: 'vertical' }} />
        <input aria-label="Phone" type="tel" placeholder="Phone (shows a Call button)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} style={input} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input aria-label="Opens" type="time" value={f.opens_at} onChange={(e) => setF({ ...f, opens_at: e.target.value })} style={input} />
          <input aria-label="Closes" type="time" value={f.closes_at} onChange={(e) => setF({ ...f, closes_at: e.target.value })} style={input} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: COLORS.textSecondary }}>
          <input type="checkbox" checked={byDay} onChange={(e) => setByDay(e.target.checked)} />
          Different hours on some days (e.g. closed Sundays)
        </label>
        {byDay && days.map((d, i) => (
          <div key={d.day} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr auto', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{WEEKDAY_NAMES[d.day].slice(0, 3)}</span>
            <input aria-label={`${WEEKDAY_NAMES[d.day]} opens`} type="time" value={d.opens} disabled={d.closed} onChange={(e) => setDay(i, { opens: e.target.value })} style={{ ...input, opacity: d.closed ? 0.4 : 1 }} />
            <input aria-label={`${WEEKDAY_NAMES[d.day]} closes`} type="time" value={d.closes} disabled={d.closed} onChange={(e) => setDay(i, { closes: e.target.value })} style={{ ...input, opacity: d.closed ? 0.4 : 1 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: COLORS.textSecondary }}>
              <input type="checkbox" checked={d.closed} onChange={(e) => setDay(i, { closed: e.target.checked })} /> Closed
            </label>
          </div>
        ))}
        <button type="submit" disabled={busy} style={{ ...primary, alignSelf: 'flex-start', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
        {msg && <p role="status" style={{ margin: 0, color: msg.ok ? COLORS.green : COLORS.red, fontSize: 13 }}>{msg.text}</p>}
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
          <p style={{ margin: 0, color: COLORS.green, fontWeight: 800 }}>
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
              <p role="status" style={{ margin: 0, color: COLORS.green, fontWeight: 700, fontSize: 13.5 }}>Got it — we&apos;ll be in touch about Pro.</p>
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

  async function add(files: File[]) {
    if (!files.length) return;
    setBusy(true); setMsg(null);
    try {
      for (const f of files) await uploadPhoto(userId, venueId, null, f);
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
        <PhotoPicker accept="image/*" max={6} disabled={busy || (data?.length ?? 0) >= 6} onFiles={(files) => { void add(files); }}
          label={(data?.length ?? 0) >= 6 ? 'Photo limit reached (6)' : 'Add photos'} hint="Up to 6. A moderator checks each one before it shows." />
        {busy && <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 13 }}>Uploading…</p>}
        {msg && <p role="status" style={{ margin: 0, color: msg.ok ? COLORS.green : COLORS.red, fontSize: 13 }}>{msg.text}</p>}
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
      <div className="brand-rule" style={{ marginTop: 28 }} />
    </>
  );
}
