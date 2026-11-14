import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Link } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
import { useLoad } from '@/lib/useLoad';
import { useIsFounder } from '@/lib/founder';
import { supabase as getSupabase } from '@/lib/supabase/client';
import { COLORS, BRAND_GRADIENT } from '@/lib/theme';

interface Overview {
  people: number; people_week: number;
  venues_live: number; venues_pending: number;
  reviews_live: number; reviews_pending: number;
  reports_open: number; claims_pending: number; pro_venues: number;
  push_ios: number; push_android: number; my_push_ios: number; my_push_android: number;
  alerts_week: number;
  staff_actions: { created_at: string; action_type: string; resource_type: string; reason: string | null; actor: string | null }[];
}

async function loadOverview(): Promise<Overview> {
  const { data, error } = await getSupabase().rpc('founder_overview');
  if (error) throw new Error(error.message);
  return data as Overview;
}

async function loadPremod(): Promise<boolean> {
  const { data, error } = await getSupabase().from('app_settings').select('value').eq('key', 'review_premoderation').maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value === true;
}

/** The owner's page (admins only): how Gossoko is doing, what's waiting, and a push check per device. */
export default function FounderPage() {
  const { user } = useAuth();
  const founder = useIsFounder();
  const o = useLoad(() => (founder === true ? loadOverview() : Promise.resolve(undefined)), [founder, user?.id]);
  const [test, setTest] = useState<string | null>(null);
  const premod = useLoad(() => (founder === true ? loadPremod() : Promise.resolve(undefined)), [founder, user?.id]);
  const [setting, setSetting] = useState<string | null>(null);
  const { signOut } = useAuth();

  async function togglePremod(next: boolean) {
    setSetting('Saving…');
    const { error } = await getSupabase().rpc('founder_set_setting', { p_key: 'review_premoderation', p_value: next });
    if (error) { setSetting(`Couldn't save: ${error.message}`); return; }
    setSetting(null);
    premod.reload();
  }

  if (!user) return <Navigate to="/login?next=%2Ffounder" replace />;
  if (founder === false) return <Navigate to="/profile" replace />;

  async function sendTest() {
    setTest('Sending…');
    const { error } = await getSupabase().rpc('founder_test_alert');
    if (error) { setTest(`Couldn't send: ${error.message}`); return; }
    window.dispatchEvent(new Event('gossoko:notices'));
    const d = o.data;
    const mine = (d?.my_push_ios ?? 0) + (d?.my_push_android ?? 0);
    setTest(mine
      ? `Sent. It should land on ${mine === 1 ? 'your device' : `your ${mine} devices`} in a few seconds, and it's in Alerts.`
      : 'Sent to Alerts. No phone is registered for push on this account yet: open the Gossoko app on a phone, sign in and allow notifications.');
    o.reload();
  }

  const d = o.data;
  return (
    <>
      <header className="top-bar">
        <div>
          <h1>FOUNDER</h1>
          <p className="top-bar__sub">Owner tools · only this login sees this</p>
        </div>
      </header>

      {o.error && <section className="section"><p style={{ color: COLORS.red }}>Couldn't load: {o.error}</p></section>}

      <section className="section">
        <div className="section-title"><h2>Overview</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          <Tile label="People" value={d?.people} hint={d ? `${d.people_week} new this week` : ''} />
          <Tile label="Venues live" value={d?.venues_live} hint={d?.venues_pending ? `${d.venues_pending} waiting` : 'none waiting'} />
          <Tile label="Reviews live" value={d?.reviews_live} hint={d?.reviews_pending ? `${d.reviews_pending} waiting` : 'none waiting'} />
          <Tile label="Open reports" value={d?.reports_open} accent={d?.reports_open ? COLORS.red : undefined} />
          <Tile label="Claims to check" value={d?.claims_pending} accent={d?.claims_pending ? COLORS.gold : undefined} />
          <Tile label="Pro venues" value={d?.pro_venues} />
          <Tile label="Alerts this week" value={d?.alerts_week} />
          <Tile label="Phones on push" value={d ? d.push_ios + d.push_android : undefined} hint={d ? `${d.push_ios} Apple · ${d.push_android} Android` : ''} />
        </div>
      </section>

      <section className="section">
        <div className="section-title"><h2>Notifications</h2></div>
        <div style={card}>
          <div style={{ fontSize: 13.5, color: COLORS.text, lineHeight: 1.5 }}>
            This account: {d ? `${d.my_push_ios} Apple and ${d.my_push_android} Android device${d.my_push_ios + d.my_push_android === 1 ? '' : 's'} on push.` : '…'}
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
            Sign in on each phone and allow notifications, then send a test. Staff get alerts for new reports, claims and venues to check.
          </div>
          <button type="button" onClick={() => { void sendTest(); }} style={button}>Send me a test alert</button>
          {test && <div role="status" style={{ marginTop: 8, fontSize: 13, color: COLORS.textSecondary }}>{test}</div>}
        </div>
      </section>

      <section className="section">
        <div className="section-title"><h2>Settings</h2></div>
        <div style={card}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={premod.data === true}
              disabled={premod.data === undefined || setting === 'Saving…'}
              onChange={(e) => { void togglePremod(e.target.checked); }}
            />
            <span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: COLORS.text }}>Approve new reviews before they show</span>
              <span style={{ display: 'block', fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                Off: reviews go live at once (links, phone numbers and spam are still held). Turn on when real sign-ups start.
              </span>
            </span>
          </label>
          {premod.error && <div style={{ marginTop: 8, fontSize: 13, color: COLORS.red }}>Couldn't load: {premod.error}</div>}
          {setting && <div role="status" style={{ marginTop: 8, fontSize: 13, color: COLORS.textSecondary }}>{setting}</div>}
        </div>
        <div style={{ ...card, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, minWidth: 0, overflowWrap: 'anywhere' }}>
            Signed in as <span style={{ color: COLORS.text }}>{user.email ?? 'owner'}</span> · admin
          </div>
          <button type="button" onClick={() => { void signOut(); }} style={{ ...button, marginTop: 0, background: COLORS.surface, color: COLORS.text, border: `1.5px solid ${COLORS.border}` }}>Sign out</button>
        </div>
      </section>

      <section className="section">
        <div className="section-title"><h2>Run it</h2></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row href="/staff/moderation" label="Moderation" hint={d ? `${d.reviews_pending + d.venues_pending} waiting · ${d.reports_open} reports` : ''} />
          <Row href="/staff/business" label="Business" hint={d ? `${d.claims_pending} claims · ${d.pro_venues} Pro` : ''} />
          <Row href="/staff/users" label="People" hint="Roles, suspensions" />
        </div>
      </section>

      <section className="section">
        <div className="section-title"><h2>Recent staff actions</h2></div>
        {!d?.staff_actions.length ? (
          <p style={{ color: COLORS.textSecondary, fontSize: 13 }}>None yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.staff_actions.map((a, i) => (
              <div key={i} style={{ ...card, padding: '8px 12px', fontSize: 12.5, color: COLORS.textSecondary }}>
                <span style={{ color: COLORS.text }}>{a.action_type.replace(/_/g, ' ')}</span> · {a.resource_type}
                {a.actor && <> · @{a.actor}</>} · {new Date(a.created_at).toLocaleString()}
                {a.reason && <div>{a.reason}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

const card = { background: COLORS.surface, border: `1.5px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 14px' } as const;
const button = {
  marginTop: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: BRAND_GRADIENT, color: '#0a0908', fontWeight: 800, fontSize: 14,
} as const;

function Tile({ label, value, hint, accent }: { label: string; value: number | undefined; hint?: string; accent?: string }) {
  return (
    <div style={card}>
      <div style={{ fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.textSecondary }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent ?? COLORS.text, marginTop: 2 }}>{value ?? '–'}</div>
      {hint && <div style={{ fontSize: 11.5, color: COLORS.textSecondary }}>{hint}</div>}
    </div>
  );
}

function Row({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link href={href} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
      <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 14 }}>{label}</span>
      <span style={{ color: COLORS.textSecondary, fontSize: 12.5 }}>{hint} ›</span>
    </Link>
  );
}
