'use client';

import { useEffect } from 'react';

// Registers /sw.js on mount. No UI — just side-effects.
// Runs in dev too so we can verify install/activate locally; the SW itself
// excludes Next.js dev/HMR paths so it doesn't interfere with hot reload.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch (err) {
        // Failure is non-fatal — the app still works without offline support.
        console.warn('[gossoko] sw registration failed', err);
      }
    };

    // Defer until idle so we don't compete with first-paint work.
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
    if (typeof idle === 'function') {
      idle(register);
    } else {
      setTimeout(register, 1500);
    }
  }, []);

  return null;
}
