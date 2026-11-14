import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isNativeShell, nativeGuardScript, salesHref, salesLinksVisible, salesRouteTarget, type ShellGlobals } from '@/site/native';
import { contactLink } from '@/config/site';
import config from '../../vite.config';

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), 'utf8');
const PAGES = ['about/index.html', 'business/index.html'];
const ios: ShellGlobals = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } };
const android: ShellGlobals = { Capacitor: { getPlatform: () => 'android' } };
const web: ShellGlobals = { Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } };

describe('isNativeShell', () => {
  it('spots the iOS and Android shells', () => {
    expect(isNativeShell(ios)).toBe(true);
    expect(isNativeShell(android)).toBe(true);
  });
  it('spots the raw bridges before Capacitor is set up', () => {
    expect(isNativeShell({ androidBridge: {} })).toBe(true);
    expect(isNativeShell({ webkit: { messageHandlers: { bridge: {} } } })).toBe(true);
  });
  it('is false in a browser (with or without @capacitor/core loaded)', () => {
    expect(isNativeShell(undefined)).toBe(false);
    expect(isNativeShell({})).toBe(false);
    expect(isNativeShell(web)).toBe(false);
    expect(isNativeShell({ webkit: { messageHandlers: {} } })).toBe(false);
  });
  it('treats a throwing bridge as web (never breaks the page)', () => {
    expect(isNativeShell({ Capacitor: { isNativePlatform: () => { throw new Error('x'); } } })).toBe(false);
  });
});

describe('native guard script (inlined into the sales pages)', () => {
  function run(g: ShellGlobals) {
    const calls: string[] = [];
    const html = { className: '' };
    const win = { ...g, location: { replace: (u: string) => calls.push(u) } };
    const doc = { documentElement: html, addEventListener: () => undefined };
    new Function('window', 'location', 'document', nativeGuardScript('/gossoko/'))(win, win.location, doc);
    return { calls, cls: html.className };
  }
  it('sends a phone app back to the app and hides web-only blocks', () => {
    for (const g of [ios, android]) {
      const r = run(g);
      expect(r.calls).toEqual(['/gossoko/']);
      expect(r.cls).toContain('in-app');
    }
  });
  it('leaves a browser on the page', () => {
    const r = run(web);
    expect(r.calls).toEqual([]);
    expect(r.cls).toBe('');
  });
});

describe('sales routes', () => {
  it('builds the static page paths under the app base', () => {
    expect(salesHref('business', '/gossoko/')).toBe('/gossoko/business/');
    expect(salesHref('about', '/gossoko')).toBe('/gossoko/about/');
  });
  it('in-app /business and /about load the static page on the web, go to the feed in the apps', () => {
    expect(salesRouteTarget('business', false, '/gossoko/')).toEqual({ kind: 'load', href: '/gossoko/business/' });
    expect(salesRouteTarget('business', true, '/gossoko/')).toEqual({ kind: 'app', to: '/' });
    expect(salesRouteTarget('about', true, '/gossoko/')).toEqual({ kind: 'app', to: '/' });
  });
  it('app links to the sales site only on the web', () => {
    expect(salesLinksVisible(web)).toBe(true);
    expect(salesLinksVisible(ios)).toBe(false);
    expect(salesLinksVisible(android)).toBe(false);
  });
  it('the app router has the /about and /business routes', () => {
    const app = read('src/App.tsx');
    expect(app).toMatch(/path="about\/\*" element={<SalesRedirect page="about" \/>}/);
    expect(app).toMatch(/path="business\/\*" element={<SalesRedirect page="business" \/>}/);
  });
  it('the build has the app plus both sales pages', () => {
    const input = (config as { build?: { rollupOptions?: { input?: Record<string, string> } } }).build?.rollupOptions?.input ?? {};
    expect(Object.keys(input).sort()).toEqual(['about', 'app', 'business']);
    expect(input.business).toMatch(/business\/index\.html$/);
    expect(input.about).toMatch(/about\/index\.html$/);
  });
});

describe('sales pages: pricing never in the apps', () => {
  it('every page carries the native guard, first thing in <head>', () => {
    for (const p of PAGES) {
      const html = read(p);
      expect(html.indexOf('<!-- gossoko:native-guard -->')).toBeGreaterThan(-1);
      expect(html.indexOf('<!-- gossoko:native-guard -->')).toBeLessThan(html.indexOf('<link rel="stylesheet"'));
    }
  });
  it('a price only appears inside a [data-web-only] section', () => {
    for (const p of PAGES) {
      // Drop every data-web-only section / details block (none nest), then no price may be left.
      const rest = read(p)
        .replace(/<section[^>]*data-web-only[^>]*>[\s\S]*?<\/section>/g, '')
        .replace(/<details[^>]*data-web-only[^>]*>[\s\S]*?<\/details>/g, '');
      expect(rest, p).not.toMatch(/\$\s?\d|A\$|a month|per month|\/mo\b/i);
    }
  });
  it('the Pro price on the business page is the configured one, inside #pricing', () => {
    const html = read('business/index.html');
    expect(html).toMatch(/<section[^>]*id="pricing"[^>]*data-web-only/);
    expect(html).toContain('<b>$19</b>');
  });
  it('the app never hard-links the sales pages with a router Link (they are static files)', () => {
    for (const f of ['src/pages/page.tsx', 'src/pages/venue/[slug]/page.tsx']) {
      const src = read(f);
      expect(src).toContain('salesLinksVisible()');
      expect(src).not.toMatch(/<Link[^>]*business/);
    }
  });
});

describe('contact link', () => {
  it('falls back to claiming in the app while no inbox is set', () => {
    const c = contactLink('/gossoko/');
    expect(c.href.startsWith('mailto:') || c.href === '/gossoko/search').toBe(true);
    expect(c.cta.length).toBeGreaterThan(0);
  });
});
