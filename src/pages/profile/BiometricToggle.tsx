import { useEffect, useState } from 'react';
import { bioEnabled, markBioAsked, setBioEnabled } from '@/lib/auth';
import { bioKind, bioWords, verifyOwner, type BioKind } from '@/lib/bio';
import { getRemember } from '@/lib/supabase/client';
import { enableBiometrics } from '@/lib/authFlow';
import { COLORS } from '@/lib/theme';

/** "Open with Face ID" on/off. Only shown in the phone/tablet app on a device that has it. */
export function BiometricToggle() {
  const [kind, setKind] = useState<BioKind>('none');
  const [on, setOn] = useState(bioEnabled());
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { void bioKind().then(setKind); }, []);
  if (kind === 'none') return null;
  const words = bioWords(kind);
  const remember = getRemember();

  async function flip(next: boolean) {
    if (!next) { setBioEnabled(false); setOn(false); setNote(null); return; }
    const ok = await enableBiometrics({ verify: verifyOwner, setOn: setBioEnabled, markAsked: markBioAsked }, words);
    setOn(ok);
    setNote(ok ? null : `${words} didn't confirm, so it's still off.`);
  }

  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: COLORS.text, fontSize: 13.5, lineHeight: 1.45 }}>
      <input type="checkbox" checked={on} disabled={!remember && !on} onChange={(e) => { void flip(e.target.checked); }} style={{ marginTop: 3 }} />
      <span>Open Gossoko with {words}
        <span style={{ display: 'block', color: COLORS.textSecondary, fontSize: 12.5 }}>
          {remember
            ? `Your sign-in is kept in this device's Keychain. With this on, ${words} unlocks it when the app opens.`
            : 'Sign in with Remember me ticked to use this.'}
        </span>
        {note && <span role="alert" style={{ display: 'block', color: COLORS.red }}>{note}</span>}
      </span>
    </label>
  );
}
