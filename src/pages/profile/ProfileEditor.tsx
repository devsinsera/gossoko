import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { invalidate } from '@/lib/useLoad';
import { isValidUsername, normalizeUsername } from '@/lib/api/auth';
import { COLORS, RADIUS } from '@/lib/theme';

export const TRADES: { value: string; label: string }[] = [
  { value: 'sparky', label: 'Sparky' }, { value: 'chippy', label: 'Chippy' }, { value: 'plumber', label: 'Plumber' },
  { value: 'builder', label: 'Builder' }, { value: 'concreter', label: 'Concreter' }, { value: 'roofer', label: 'Roofer' },
  { value: 'tiler', label: 'Tiler' }, { value: 'brickie', label: 'Brickie' }, { value: 'painter', label: 'Painter' },
  { value: 'plasterer', label: 'Plasterer' }, { value: 'landscaper', label: 'Landscaper' }, { value: 'scaffolder', label: 'Scaffolder' },
  { value: 'mechanic', label: 'Mechanic' }, { value: 'operator', label: 'Machine operator' }, { value: 'labourer', label: 'Labourer' },
  { value: 'tradie', label: 'Other trade' }, { value: 'other', label: 'Not a tradie' },
];

const field = { background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' } as const;

export function ProfileEditor({ userId, initial }: { userId: string; initial: { username: string; full_name: string; bio: string; trade: string } }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const username = normalizeUsername(f.username);
    if (!isValidUsername(username)) { setMsg({ ok: false, text: 'Username must be 3–32 characters: letters, numbers, spaces, underscores.' }); return; }
    setBusy(true);
    setMsg(null);
    const { error } = await supabase().from('profiles').update({
      username, full_name: f.full_name.trim() || null, bio: f.bio.trim() || null, trade_type: f.trade,
    }).eq('id', userId);
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: /username|unique|duplicate/i.test(error.message) ? `"${username}" is taken — try another.` : 'Couldn\'t save. Try again.' });
      return;
    }
    setMsg({ ok: true, text: 'Saved.' });
    invalidate();
    setOpen(false);
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.orange, borderRadius: RADIUS.md, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Edit profile</button>;
  }
  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 8, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, padding: 14 }}>
      <label style={{ fontSize: 12, color: COLORS.textSecondary }}>Username
        <input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} maxLength={32} autoCapitalize="none" style={field} />
      </label>
      <label style={{ fontSize: 12, color: COLORS.textSecondary }}>Name
        <input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} maxLength={60} style={field} />
      </label>
      <label style={{ fontSize: 12, color: COLORS.textSecondary }}>Trade
        <select value={f.trade} onChange={(e) => setF({ ...f, trade: e.target.value })} style={field}>
          {TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label style={{ fontSize: 12, color: COLORS.textSecondary }}>Bio
        <textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} rows={3} maxLength={280} placeholder="Sparky out of Rocklea. Pie before 6, coffee after." style={{ ...field, resize: 'vertical' }} />
      </label>
      {msg && <p role={msg.ok ? 'status' : 'alert'} style={{ margin: 0, fontSize: 13, color: msg.ok ? COLORS.hiVisGreen : COLORS.red }}>{msg.text}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={busy} style={{ background: COLORS.orange, color: '#0a0908', border: 'none', borderRadius: RADIUS.md, padding: '10px 16px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: COLORS.textSecondary, cursor: 'pointer' }}>Cancel</button>
      </div>
    </form>
  );
}
