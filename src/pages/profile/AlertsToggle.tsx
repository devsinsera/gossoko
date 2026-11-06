import { useEffect, useState } from 'react';
import { supabase as getSupabase } from '@/lib/supabase/client';
import { COLORS } from '@/lib/theme';

/** Alerts + the weekly owner email on/off (profiles.receives_notifications). */
export function AlertsToggle({ userId }: { userId: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getSupabase().from('profiles').select('receives_notifications').eq('id', userId).maybeSingle()
      .then(({ data, error }) => { if (error) setErr(error.message); else setOn(data?.receives_notifications !== false); });
  }, [userId]);

  async function flip(next: boolean) {
    setOn(next);
    const { error } = await getSupabase().from('profiles').update({ receives_notifications: next }).eq('id', userId);
    if (error) { setOn(!next); setErr('Couldn\'t save that. Try again.'); } else setErr(null);
  }

  if (on === null && !err) return null;
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: COLORS.text, fontSize: 13.5, lineHeight: 1.45 }}>
      <input type="checkbox" checked={on ?? true} onChange={(e) => flip(e.target.checked)} style={{ marginTop: 3 }} />
      <span>Alerts &amp; weekly venue email
        <span style={{ display: 'block', color: COLORS.textSecondary, fontSize: 12.5 }}>New reviews on venues you manage, replies to your reviews, and a Monday summary for owners.</span>
        {err && <span role="alert" style={{ display: 'block', color: COLORS.red }}>{err}</span>}
      </span>
    </label>
  );
}
