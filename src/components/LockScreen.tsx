import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { BRAND_GRADIENT, COLORS, RADIUS, SPACE } from '@/lib/theme';
import wordmarkUrl from '@/assets/brand/gossoko-wordmark.svg';
import { bioKind, bioWords, type BioKind } from '@/lib/bio';

/**
 * Shown on launch when biometrics are on. Asks for the biometric check (device
 * passcode as fallback); if that fails or is cancelled the user can retry or
 * drop to a full sign-in.
 */
export function LockScreen() {
  const { unlock, fullSignIn } = useAuth();
  const [kind, setKind] = useState<BioKind>('none');
  const [busy, setBusy] = useState(false);
  const asked = useRef(false);

  const tryUnlock = async () => {
    setBusy(true);
    try { await unlock(); } finally { setBusy(false); }
  };

  useEffect(() => {
    void bioKind().then(setKind);
    if (asked.current) return;
    asked.current = true;
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const words = bioWords(kind) || 'your passcode';
  return (
    <div style={{
      minHeight: '100vh', background: COLORS.bg, color: COLORS.text,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: SPACE.lg, padding: SPACE.lg, textAlign: 'center',
    }}>
      <h1 style={{ margin: 0 }}>
        <img src={wordmarkUrl} alt="Gossoko" style={{ display: 'block', height: 44, width: 'auto' }} />
      </h1>
      <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: 14 }}>Locked. Use {words} to open.</p>
      <button
        type="button"
        onClick={tryUnlock}
        disabled={busy}
        style={{
          background: BRAND_GRADIENT, boxShadow: '0 10px 26px -10px rgba(255, 122, 0, 0.6)', color: '#0a0908', border: 'none', borderRadius: RADIUS.md,
          padding: '12px 22px', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: busy ? 0.6 : 1,
        }}
      >
        Unlock
      </button>
      <button
        type="button"
        onClick={() => { void fullSignIn(); }}
        style={{ background: 'none', border: 'none', color: COLORS.textSecondary, fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}
      >
        Sign in with password instead
      </button>
    </div>
  );
}
