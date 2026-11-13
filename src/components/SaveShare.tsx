import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '@/lib/theme';
import { HeartIcon } from './icons';
import { toggleSave } from '@/pages/_business/actions';
import { shareVenue } from '@/lib/share';
import { trackVenueEvent } from '@/lib/queries/business';

const btn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  border: `1px solid ${COLORS.border}`, borderRadius: 8, background: COLORS.surface,
  color: COLORS.text, cursor: 'pointer', minHeight: 40,
} as const;
const label = { fontFamily: 'var(--font-label)', fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase' } as const;

/** Save to my spots, and share the venue to a group chat. */
export function SaveShare({ venueId, slug, name, initialSaved, signedIn }: {
  venueId: string; slug: string; name: string; initialSaved: boolean; signedIn: boolean;
}) {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => setSaved(initialSaved), [initialSaved]);

  async function save() {
    if (!signedIn) { navigate(`/login?next=${encodeURIComponent(`/venue/${slug}`)}`); return; }
    setBusy(true);
    const res = await toggleSave(venueId, saved);
    setBusy(false);
    if (res.ok) setSaved(res.saved);
    else setNote(res.error);
  }

  async function share() {
    const out = await shareVenue(slug, name);
    if (out === 'shared' || out === 'copied') trackVenueEvent(venueId, 'share');
    setNote(out === 'copied' ? 'Link copied.' : out === 'failed' ? 'Couldn\'t share from here.' : null);
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {note && <span role="status" style={{ color: COLORS.textSecondary, fontSize: 12 }}>{note}</span>}
      <button type="button" onClick={share} aria-label="Share this venue" style={btn}>
        <span style={label}>Share</span>
      </button>
      <button type="button" onClick={save} disabled={busy} aria-pressed={saved} aria-label={saved ? 'Remove from saved spots' : 'Save this venue'}
        style={{ ...btn, color: saved ? COLORS.orange : COLORS.text, borderColor: saved ? COLORS.orange : COLORS.border, opacity: busy ? 0.7 : 1 }}>
        <HeartIcon size={16} filled={saved} />
        <span style={label}>{saved ? 'Saved' : 'Save'}</span>
      </button>
    </div>
  );
}
