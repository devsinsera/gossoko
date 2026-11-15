import { useEffect, useState } from 'react';
import { COLORS } from '@/lib/theme';
import {
  nativeVisits, loadSettings, saveSettings, syncVisits, clearMyCheckIns, RULES,
  type VisitSettings, type VisitsStatus,
} from '@/lib/visits';

const row: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', color: COLORS.text, fontSize: 13.5, lineHeight: 1.45 };
const note: React.CSSProperties = { display: 'block', color: COLORS.textSecondary, fontSize: 12.5 };
const btn: React.CSSProperties = {
  minHeight: 40, padding: '0 14px', borderRadius: 999, border: `1px solid ${COLORS.border}`,
  background: COLORS.surface, color: COLORS.text, fontSize: 13, cursor: 'pointer',
};

const LOCATION_WORDS: Record<VisitsStatus['location'], string> = {
  always: 'Location: Always. Arrival alerts work with Gossoko closed.',
  whenInUse: 'Location: While using the app. Arrival alerts need "Always". Change it in Settings → Gossoko → Location.',
  denied: 'Location is off for Gossoko. Turn it on in Settings → Gossoko → Location.',
  none: 'Gossoko hasn\'t asked for your location yet.',
};

/** Profile → "Check-ins & nearby alerts". Everything is off until switched on here. */
export function VisitsSettings({ userId }: { userId: string }) {
  const native = nativeVisits();
  const [s, setS] = useState<VisitSettings>(loadSettings);
  const [status, setStatus] = useState<VisitsStatus | null>(null);
  const [muted, setMuted] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!native) return;
    void native.status().then(setStatus).catch(() => {});
    void native.mutedCount().then((r) => setMuted(r.count)).catch(() => {});
  }, [native]);

  async function apply(next: VisitSettings, ask: boolean) {
    setBusy(true); setMsg(null);
    try {
      if (native && next.enabled && ask) {
        let st = await native.requestWhenInUse();
        if (st.location !== 'denied' && next.arrival) st = await native.requestAlways();
        setStatus(st);
        if (st.location === 'denied' || st.location === 'none') {
          next = { ...next, enabled: false };
          setMsg('Gossoko needs your location for this. Turn it on in Settings → Gossoko → Location, then switch this on again.');
        } else if (st.notifications === 'denied') {
          setMsg('Notifications are off for Gossoko, so alerts can\'t show. Turn them on in Settings → Gossoko → Notifications.');
        }
      }
      setS(next); saveSettings(next);
      await syncVisits(userId);
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    setBusy(true); setMsg(null);
    try {
      const n = await clearMyCheckIns();
      setMsg(n ? `Cleared ${n} check-in${n === 1 ? '' : 's'}.` : 'You have no check-ins.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Couldn\'t clear them. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
      <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 14 }}>Check-ins &amp; nearby alerts</div>
      {!native ? (
        <span style={note}>
          When you&rsquo;re at a venue, its page shows <b>Check in</b>. Reviews written within a day of a check-in show
          &ldquo;Verified visit&rdquo;. Arrival alerts and &ldquo;How was it?&rdquo; prompts need the Gossoko app on your phone.
        </span>
      ) : (
        <>
          <label style={row}>
            <input type="checkbox" checked={s.enabled} disabled={busy} onChange={(e) => apply({ ...s, enabled: e.target.checked }, e.target.checked)} style={{ marginTop: 3 }} />
            <span>Nearby alerts
              <span style={note}>
                Your phone watches the {RULES.maxRegionsIos} venues nearest to you. Stay {RULES.arrivalDwellS / 60} minutes and it asks
                &ldquo;At &lt;venue&gt;?&rdquo; with its rating, and you can check in. Stay a while and it asks how it was.
                Your position stays on the phone. Gossoko only saves which venue and when, and only for check-ins.
              </span>
            </span>
          </label>
          {s.enabled && (
            <div style={{ display: 'grid', gap: 10, paddingLeft: 24 }}>
              <label style={row}>
                <input type="checkbox" checked={s.arrival} disabled={busy} onChange={(e) => apply({ ...s, arrival: e.target.checked }, e.target.checked)} style={{ marginTop: 3 }} />
                <span>Arrival alerts<span style={note}>Once a day per venue at most. Needs location &ldquo;Always&rdquo;.</span></span>
              </label>
              <label style={row}>
                <input type="checkbox" checked={s.prompts} disabled={busy} onChange={(e) => apply({ ...s, prompts: e.target.checked }, false)} style={{ marginTop: 3 }} />
                <span>Ask me to review after a visit
                  <span style={note}>After {RULES.reviewDwellS / 60} minutes there, or as you leave after {RULES.reviewOnLeaveMinS / 60}. Once a week per venue at most, and never for a place you reviewed in the last {RULES.reviewedSkipD} days.</span>
                </span>
              </label>
              <div style={{ ...row, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>Quiet from</span>
                <input type="time" value={s.quietFrom} disabled={busy} onChange={(e) => apply({ ...s, quietFrom: e.target.value }, false)} style={{ fontSize: 16 }} />
                <span>to</span>
                <input type="time" value={s.quietTo} disabled={busy} onChange={(e) => apply({ ...s, quietTo: e.target.value }, false)} style={{ fontSize: 16 }} />
              </div>
              {status && <span style={note}>{LOCATION_WORDS[status.location]}</span>}
              {muted > 0 && (
                <div style={{ ...row, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={note}>{muted} place{muted === 1 ? '' : 's'} set to &ldquo;Don&rsquo;t ask for this place&rdquo;.</span>
                  <button type="button" style={btn} disabled={busy} onClick={async () => { await native.clearMuted(); setMuted(0); }}>Ask again</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <div>
        <button type="button" style={btn} disabled={busy} onClick={clearAll}>Clear my check-ins</button>
      </div>
      {msg && <span role="status" style={{ ...note, color: COLORS.text }}>{msg}</span>}
    </div>
  );
}
