import { useState } from 'react';
import { deleteMyAccount } from '@/lib/api/admin';
import { COLORS, RADIUS } from '@/lib/theme';

/** Permanently deletes the account: profile, reviews, comments, photos (files too), saved spots, codes. Asks for the word DELETE. */
export function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    const res = await deleteMyAccount();
    setBusy(false);
    if (res.ok) { onDeleted(); return; }
    setErr(res.error === 'staff' ? 'Admin and moderator accounts can\'t be deleted here — ask an owner to change your role first.' : 'Couldn\'t delete your account. Try again, or get in touch.');
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', color: COLORS.textMuted, textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0 }}>Delete my account</button>;
  }
  return (
    <div style={{ border: `1px solid ${COLORS.red}`, borderRadius: RADIUS.md, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, color: COLORS.text, fontSize: 13.5, lineHeight: 1.5 }}>
        This permanently deletes your account, reviews, comments, photos, saved spots and deal codes. It can&apos;t be undone.
        Venues you added stay on Gossoko.
      </p>
      <input aria-label="Type DELETE to confirm" placeholder="Type DELETE" value={word} onChange={(e) => setWord(e.target.value)} autoCapitalize="characters" autoComplete="off"
        style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: '10px 12px', fontSize: 14 }} />
      {err && <p role="alert" style={{ margin: 0, color: COLORS.red, fontSize: 13 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={word !== 'DELETE' || busy} onClick={go}
          style={{ background: COLORS.red, color: '#fff', border: 'none', borderRadius: RADIUS.md, padding: '10px 16px', fontWeight: 800, fontSize: 13.5, cursor: word === 'DELETE' ? 'pointer' : 'not-allowed', opacity: word === 'DELETE' && !busy ? 1 : 0.5 }}>
          {busy ? 'Deleting…' : 'Delete everything'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setWord(''); }} style={{ background: 'none', border: 'none', color: COLORS.textSecondary, cursor: 'pointer' }}>Keep my account</button>
      </div>
    </div>
  );
}
