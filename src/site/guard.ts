// The website inside a phone app: go to the app. The same check is inlined in <head> for hosts that
// allow inline scripts; the live site's Content-Security-Policy (script-src 'self') does not, so this
// file is the one that runs there.
// On the website itself it also plays the opening — once, on the first page of the visit (Peta, 15 Nov
// 2026: like metreup.com.au; Log in / Get started never replay it). Loaded in <head>, so it runs as soon
// as the page is parsed, before the visitor has looked at anything.
import { isNativeShell, type ShellGlobals } from './native';
import { playBrandIntro } from '@/components/brandIntroPlayer';
import { introWanted, markIntroPlayed } from '@/lib/brandIntro';

function session(): Storage | null { try { return window.sessionStorage; } catch { return null; } }

if (typeof window !== 'undefined' && isNativeShell(window as unknown as ShellGlobals)) {
  document.documentElement.className += ' in-app';
  window.location.replace('/gossoko/admin/');
} else if (typeof window !== 'undefined') {
  const store = session();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (introWanted({ native: false, path: window.location.pathname, storage: store, reducedMotion })) {
    markIntroPlayed(store);
    const start = () => playBrandIntro();
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
  }
}
