import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

/**
 * Owner login: the Founder page is only this one account, not every admin (Peta, 14 Nov 2026).
 * The address itself is not written here, because this file ships in the public bundle: only its
 * SHA-256 is. This decides what the menu SHOWS; the data behind the page is still checked by the
 * server (is_admin), so it grants nothing.
 */
export const FOUNDER_EMAIL_SHA256 = 'a3f404a28ed64739fe5af791411a3207542c331cf3efa4021a9853e539369a46';

const cache = new Map<string, boolean>();

export async function isFounderEmail(email?: string | null): Promise<boolean> {
  const clean = (email || '').trim().toLowerCase();
  if (!clean) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clean));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === FOUNDER_EMAIL_SHA256;
}

/** True for the owner login, false for everyone else, null while checking. Cached per address. */
export function useIsFounder(): boolean | null {
  const { user, status } = useAuth();
  const email = user?.email ?? null;
  const waiting = status === 'loading' || status === 'locked';
  const [v, setV] = useState<boolean | null>(email ? cache.get(email) ?? null : waiting ? null : false);
  useEffect(() => {
    if (waiting) { setV(null); return; }
    if (!email) { setV(false); return; }
    if (cache.has(email)) { setV(cache.get(email)!); return; }
    let live = true;
    isFounderEmail(email).then((ok) => { cache.set(email, ok); if (live) setV(ok); }, () => { if (live) setV(false); });
    return () => { live = false; };
  }, [email, waiting]);
  return v;
}
