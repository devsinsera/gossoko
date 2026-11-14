// The sales website (about/ and business/) is web only. The iPhone, iPad and Android apps load
// this same site, and Apple (3.1.1) and Google don't allow a price for a digital subscription to be
// shown inside an app that doesn't sell it through their own billing. So:
//   * the sales pages carry an inline guard (inlined into their <head> at build time by the
//     `gossoko-native-guard` plugin in vite.config.ts) that sends a native shell straight back to the
//     app before anything paints, and marks <html class="in-app"> so any [data-web-only] block is
//     hidden even if the redirect were blocked;
//   * the app itself only links to the sales pages on the web (salesLinksVisible()).

/** The parts of `window` the shells add: Capacitor's bridge (iOS message handler, Android bridge). */
export type ShellGlobals = {
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  androidBridge?: unknown;
  webkit?: { messageHandlers?: { bridge?: unknown } };
};

/**
 * True inside the iOS / Android shells. Self-contained on purpose (no imports, no closures): its
 * source is inlined into the sales pages' <head> by Function.prototype.toString.
 */
export function isNativeShell(g: ShellGlobals | undefined): boolean {
  if (!g) return false;
  try {
    const cap = g.Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
    const p = cap && typeof cap.getPlatform === 'function' ? cap.getPlatform() : '';
    if (p === 'ios' || p === 'android') return true;
    // The bridges exist from document start, before Capacitor's JS object is set up.
    if (g.androidBridge) return true;
    if (g.webkit && g.webkit.messageHandlers && g.webkit.messageHandlers.bridge) return true;
  } catch {
    return false;
  }
  return false;
}

/** The inline <script> body for a sales page: in an app, hide web-only blocks and go to the app. */
export function nativeGuardScript(appHome: string): string {
  return `(function(){var isNativeShell=${isNativeShell.toString()};`
    + `function go(){if(!isNativeShell(window))return false;document.documentElement.className+=' in-app';`
    + `location.replace(${JSON.stringify(appHome)});return true;}`
    + `if(!go())document.addEventListener('DOMContentLoaded',go);})();`;
}

/** The sales pages, by their folder under the app base. */
export const SALES_PAGES = { about: 'about/', business: 'business/' } as const;
export type SalesPage = keyof typeof SALES_PAGES;

/**
 * The legal pages (privacy/, terms/). Unlike the sales pages these carry NO price and NO native
 * guard, so they open inside the apps (Apple and Google require both to be reachable there).
 */
export const LEGAL_PAGES = { privacy: 'privacy/', terms: 'terms/' } as const;
export type LegalPage = keyof typeof LEGAL_PAGES;

/** Full path of a legal page under the app base (e.g. '/gossoko/' -> '/gossoko/privacy/'). */
export function legalHref(page: LegalPage, base: string): string {
  return `${base.replace(/\/?$/, '/')}${LEGAL_PAGES[page]}`;
}

/** Full path of a sales page under the app base (e.g. '/gossoko/' -> '/gossoko/business/'). */
export function salesHref(page: SalesPage, base: string): string {
  return `${base.replace(/\/?$/, '/')}${SALES_PAGES[page]}`;
}

/**
 * Where the app's /about and /business routes go. The real pages are static files the server
 * serves first, so these routes only catch an in-app navigation: on the web, load the static page;
 * in a native shell, back to the feed (no prices in the apps).
 */
export function salesRouteTarget(page: SalesPage, native: boolean, base: string):
  { kind: 'app'; to: string } | { kind: 'load'; href: string } {
  return native ? { kind: 'app', to: '/' } : { kind: 'load', href: salesHref(page, base) };
}

/** Whether the app may show links to the sales pages (web only). */
export function salesLinksVisible(g: ShellGlobals | undefined = globalThis as ShellGlobals): boolean {
  return !isNativeShell(g);
}
