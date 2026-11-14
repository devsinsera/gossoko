import { useLayoutEffect } from 'react';
import { playBrandIntro } from '@/components/brandIntroPlayer';
import { introWanted, markIntroPlayed } from '@/lib/brandIntro';
import { APP_BASE } from '@/lib/env';

function sessionStore(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

/**
 * The app's opening (the animation itself is components/brandIntroPlayer.ts, shared with the website).
 * useLayoutEffect, not useEffect: the overlay is built and positioned before the browser draws the first
 * frame, so nothing flashes at the top-left before it starts (15 Nov 2026). Mounted once, so moving
 * between pages never replays it. When it plays: lib/brandIntro.ts introWanted().
 */
export function BrandIntro() {
  useLayoutEffect(() => {
    const native = Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
    const path = window.location.pathname.slice(APP_BASE.replace(/\/$/, '').length);
    const store = sessionStore();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!introWanted({ native, path, storage: store, reducedMotion })) return;
    markIntroPlayed(store);
    return playBrandIntro();
  }, []);
  return null;
}
