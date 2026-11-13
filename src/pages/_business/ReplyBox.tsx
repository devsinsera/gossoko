import { useState } from 'react';
import { COLORS, RADIUS, BRAND_GRADIENT } from '@/lib/theme';
import type { OwnerReply } from '@/lib/queries/business';
import { postReply, removeReply } from './actions';

/** The venue's reply under a review. The verified owner sees a reply form (or a Remove link). */
export function ReplyBox({ reviewId, reply, venueName, isOwner }: {
  reviewId: string; reply?: OwnerReply; venueName: string; isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    const res = await postReply(reviewId, body);
    setBusy(false);
    if (res.ok) { setBody(''); setOpen(false); } else setError(res.error);
  }

  if (reply) {
    return (
      <div style={{ marginTop: 10, padding: '9px 12px', background: COLORS.surfaceAlt, borderLeft: `3px solid ${COLORS.orange}`, borderRadius: RADIUS.sm }}>
        <div style={{ fontSize: 11, color: COLORS.orange, fontFamily: 'var(--font-label)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
          Reply from {venueName}
        </div>
        <p style={{ margin: '4px 0 0', color: COLORS.text, fontSize: 13.5, lineHeight: 1.5 }}>{reply.body}</p>
        {isOwner && (
          <button type="button" onClick={async () => { const r = await removeReply(reply.id); if (!r.ok) setError(r.error); }}
            style={{ marginTop: 6, background: 'none', border: 'none', color: COLORS.textMuted, fontSize: 11.5, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            Remove reply
          </button>
        )}
        {error && <p role="alert" style={{ margin: '4px 0 0', color: COLORS.red, fontSize: 12 }}>{error}</p>}
      </div>
    );
  }
  if (!isOwner) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{ marginTop: 10, background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.orange, borderRadius: RADIUS.md, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
        Reply as {venueName}
      </button>
    );
  }
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={800} placeholder="Thank them, fix it, or explain what happened. Be nice — everyone can read it."
        style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
      {error && <p role="alert" style={{ margin: 0, color: COLORS.red, fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={send} disabled={busy}
          style={{ background: BRAND_GRADIENT, color: '#0a0908', border: 'none', borderRadius: RADIUS.md, padding: '8px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Posting…' : 'Post reply'}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          style={{ background: 'none', color: COLORS.textSecondary, border: 'none', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}
