import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useCoords, useNear } from '@/components/DistanceProvider';
import { checkInHere, myVisitCount, venueHere, type CheckInResult } from '@/lib/visits';
import { COLORS, BRAND_GRADIENT } from '@/lib/theme';
import { Link } from '@/lib/nav';
import { MapPinIcon } from '@/components/icons';

type Place = { id: string; name: string; slug?: string; lat: number; lng: number };

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']; const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * "You're at <venue> — Check in". Shows when the phone's position is at the venue (or `force`, e.g. the
 * arrival alert opened this page). The check-in itself takes a fresh, sharp fix and the server re-checks it.
 */
export function CheckInCard({ venue, force = false, linkToVenue = false }: { venue: Place; force?: boolean; linkToVenue?: boolean }) {
  const { user } = useAuth();
  const coords = useCoords();
  const { near } = useNear();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<CheckInResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [visits, setVisits] = useState(0);
  const here = !near && coords ? venueHere([venue], coords, 50) !== null : false;

  useEffect(() => {
    if (!user || !(here || force)) return;
    let live = true;
    void myVisitCount(user.id, venue.id).then((n) => { if (live) setVisits(n); });
    return () => { live = false; };
  }, [user, venue.id, here, force]);

  if (!user || !(here || force || done)) return null;

  async function go() {
    setBusy(true); setErr(null);
    try {
      const r = await checkInHere(venue);
      setDone(r); setVisits(r.visits);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Couldn\'t check in. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const name = linkToVenue && venue.slug
    ? <Link href={`/venue/${venue.slug}`} style={{ color: COLORS.text, textDecoration: 'underline' }}>{venue.name}</Link>
    : venue.name;

  return (
    <section aria-live="polite" style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      margin: '12px 0', padding: '12px 14px', borderRadius: 14,
      background: COLORS.surface, border: `1.5px solid ${done ? COLORS.green : COLORS.border}`,
    }}>
      <MapPinIcon size={20} />
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 15 }}>
          {done ? <>Checked in at {name}</> : <>You&rsquo;re at {name}</>}
        </div>
        <div style={{ color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 1.4 }}>
          {done
            ? (done.new ? `Your ${ordinal(done.visits)} visit. A review today shows "Verified visit".` : 'Already checked in here today.')
            : visits > 0 ? `You've checked in here ${visits === 1 ? 'once' : `${visits} times`}.` : 'Check in and your review shows "Verified visit".'}
        </div>
        {err && <div role="alert" style={{ color: COLORS.red, fontSize: 12.5, marginTop: 4 }}>{err}</div>}
      </div>
      {!done && (
        <button type="button" onClick={go} disabled={busy} style={{
          minHeight: 44, padding: '0 18px', borderRadius: 999, border: 'none', cursor: busy ? 'wait' : 'pointer',
          background: BRAND_GRADIENT, color: '#0a0908', fontWeight: 800, fontSize: 14,
        }}>{busy ? 'Checking…' : 'Check in'}</button>
      )}
    </section>
  );
}

/** Nearby: the venue you're standing at, if any. */
export function CheckInHere({ venues }: { venues: Place[] }) {
  const coords = useCoords();
  const { near } = useNear();
  if (near || !coords) return null;
  const v = venueHere(venues, coords, 50);
  return v ? <CheckInCard venue={v} linkToVenue /> : null;
}
