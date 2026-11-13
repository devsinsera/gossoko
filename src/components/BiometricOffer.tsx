import { useEffect, useState } from 'react';
import { bioAsked, markBioAsked, setBioEnabled, useAuth } from '@/lib/auth';
import { bioKind, bioWords, verifyOwner, type BioKind } from '@/lib/bio';
import { COLORS, RADIUS, SPACE, BRAND_GRADIENT } from '@/lib/theme';

/**
 * After a successful sign-in on a phone/tablet that has Face ID / Touch ID /
 * Optic ID, offer to lock the app behind it. Shown a moment after sign-in so
 * iOS's own Save Password prompt isn't talked over.
 */
export function BiometricOffer() {
  const { status } = useAuth();
  const [kind, setKind] = useState<BioKind>('none');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (status !== 'in' || bioAsked()) return;
    let live = true;
    const t = window.setTimeout(async () => {
      const k = await bioKind();
      if (live && k !== 'none') { setKind(k); setShow(true); }
    }, 1800);
    return () => { live = false; window.clearTimeout(t); };
  }, [status]);

  if (!show) return null;
  const words = bioWords(kind);

  const enable = async () => {
    // Prove it works before turning it on, so the owner can't lock themselves out.
    if (await verifyOwner(`Turn on ${words} for Gossoko`)) setBioEnabled(true);
    else markBioAsked();
    setShow(false);
  };

  return (
    <div role="dialog" aria-label={`Use ${words}`} className="sheet" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100,
      padding: `${SPACE.lg}px ${SPACE.lg}px calc(${SPACE.lg}px + env(safe-area-inset-bottom, 0px))`,
      background: COLORS.surface, borderTop: `1.5px solid ${COLORS.orange}`,
      display: 'flex', flexDirection: 'column', gap: SPACE.sm,
    }}>
      <strong style={{ fontSize: 16 }}>Open Gossoko with {words}?</strong>
      <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
        Skip typing your password. Your {words === 'biometrics' ? 'biometrics' : words} never leave your device.
      </span>
      <div style={{ display: 'flex', gap: SPACE.sm }}>
        <button type="button" onClick={enable} style={{
          flex: 1, background: BRAND_GRADIENT, color: '#0a0908', border: 'none',
          borderRadius: RADIUS.md, padding: '12px', fontWeight: 800, cursor: 'pointer',
        }}>Turn on</button>
        <button type="button" onClick={() => { markBioAsked(); setShow(false); }} style={{
          flex: 1, background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md, padding: '12px', cursor: 'pointer',
        }}>Not now</button>
      </div>
    </div>
  );
}
