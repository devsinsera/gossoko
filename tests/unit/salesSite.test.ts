import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isNativeShell, nativeGuardScript, legalHref, SALES_PAGES, salesHref, salesLinksVisible, salesRouteTarget, type ShellGlobals } from '@/site/native';
import { contactLink, legalTokens, LEGAL_ENTITY, ABN } from '@/config/site';
import config from '../../vite.config';

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), 'utf8');
const PAGES = ['index.html', 'business/index.html'];   // the website's front page was about/ until 14 Nov 2026
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
    expect(salesHref('about', '/gossoko')).toBe('/gossoko/');
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
  it('the build has the app, both sales pages and both legal pages', () => {
    const input = (config as { build?: { rollupOptions?: { input?: Record<string, string> } } }).build?.rollupOptions?.input ?? {};
    expect(Object.keys(input).sort()).toEqual(['app', 'business', 'home', 'login', 'privacy', 'terms']);
    expect(input.business).toMatch(/business\/index\.html$/);
    expect(input.home).toMatch(/gossoko[^/]*\/index\.html$|\/index\.html$/);
    expect(input.app).toMatch(/admin\/index\.html$/);
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

const PRICE = /\$\s?\d|A\$|\bAUD\b|a month|per month|a week|per week|\/mo\b|\/wk\b|\bprice/i;
const LEGAL = ['privacy/index.html', 'terms/index.html'];

describe('Featured pricing (web only)', () => {
  const html = read('business/index.html');
  const pricing = html.match(/<section[^>]*id="pricing"[\s\S]*?<\/section>/)![0];
  it('shows Featured at $49 a week or $149 a month, and Smoko sponsorship from $500, inside #pricing', () => {
    expect(pricing).toContain('<b>$49</b>');
    expect(pricing).toContain('$149 a month');
    expect(pricing).toMatch(/from<\/span><b>\$500<\/b>/);
    expect(pricing).toMatch(/one venue or brand at a time/i);
  });
  it('says it is invoiced / arranged by contact and only describes what is built', () => {
    expect(pricing).toMatch(/arranged by contact and invoiced/i);
    expect(pricing).toMatch(/top of Nearby and Search/);
    expect(pricing).toMatch(/Promoted/);
    expect(pricing).toMatch(/Rankings/);
    expect(pricing).toMatch(/No commission/i);
  });
  it('the Featured prices are not in the page outside web-only blocks (hidden in the apps)', () => {
    const rest = html
      .replace(/<section[^>]*data-web-only[^>]*>[\s\S]*?<\/section>/g, '')
      .replace(/<details[^>]*data-web-only[^>]*>[\s\S]*?<\/details>/g, '');
    expect(rest).not.toMatch(/\$49|\$149|\$500/);
    // the whole pricing block is inside a data-web-only section the native guard hides
    expect(html).toMatch(/<section[^>]*id="pricing"[^>]*data-web-only/);
  });
});

describe('legal pages: privacy + terms', () => {
  it('exist, are built, have their own title, description and canonical', () => {
    const input = (config as { build?: { rollupOptions?: { input?: Record<string, string> } } }).build?.rollupOptions?.input ?? {};
    expect(input.privacy).toMatch(/privacy\/index\.html$/);
    expect(input.terms).toMatch(/terms\/index\.html$/);
    const titles = new Set<string>();
    for (const p of LEGAL) {
      const html = read(p);
      const title = html.match(/<title>([^<]+)<\/title>/)![1];
      titles.add(title);
      expect(html).toMatch(/<meta name="description" content="[^"]{40,}"/);
      expect(html).toContain(`href="https://sinsera.co/gossoko/${p.split('/')[0]}/"`);
      expect(html).toContain('Last updated __LEGAL_UPDATED__');
    }
    expect(titles.size).toBe(2);
  });
  it('contain no prices (so they can be shown inside the apps) and no native guard', () => {
    for (const p of LEGAL) {
      const html = read(p);
      expect(html, p).not.toMatch(PRICE);
      expect(html).not.toContain('gossoko:native-guard');
      expect(html).not.toContain('data-web-only');
    }
  });
  it('are linked from the footer of /about/ and /business/ and from each other', () => {
    for (const p of PAGES) {
      const foot = read(p).split('<footer')[1];
      expect(foot, p).toContain('href="/gossoko/privacy/"');
      expect(foot, p).toContain('href="/gossoko/terms/"');
    }
    for (const p of LEGAL) {
      const foot = read(p).split('<footer')[1];
      expect(foot).toContain('href="/gossoko/privacy/"');
      expect(foot).toContain('href="/gossoko/terms/"');
    }
  });
  it('are reachable inside the native apps: Profile and Sign up link them with no web-only check', () => {
    expect(legalHref('privacy', '/gossoko/')).toBe('/gossoko/privacy/');
    expect(legalHref('terms', '/gossoko')).toBe('/gossoko/terms/');
    const links = read('src/components/LegalLinks.tsx');
    expect(links).not.toContain('salesLinksVisible');
    expect(read('src/pages/profile/page.tsx')).toContain('<LegalLinks');
    expect(read('src/pages/signup/page.tsx')).toContain('<LegalLinks');
  });
  it('never route the native shell away (no guard script) and the legal routes are not sales pages', () => {
    expect(Object.keys(SALES_PAGES)).toEqual(['about', 'business']);
  });
  it('are filled in with the operator details from src/config/site.ts', () => {
    expect(LEGAL_ENTITY).toBe('Sinsera Pty Ltd');
    expect(ABN).toMatch(/^\d{2} \d{3} \d{3} \d{3}$/);
    const tokens = legalTokens();
    for (const p of LEGAL) {
      for (const t of read(p).match(/__[A-Z_]+__/g) ?? []) expect(Object.keys(tokens), t).toContain(t);
    }
  });
  it('state the things the policy must: Privacy Act, OAIC, Queensland, 16+, Australian Consumer Law', () => {
    const priv = read('privacy/index.html');
    expect(priv).toMatch(/Privacy Act 1988/);
    expect(priv).toMatch(/OAIC/);
    expect(priv).toMatch(/Notifiable Data Breaches/);
    expect(priv).toMatch(/under 16/);
    expect(priv).toMatch(/Delete my account/);
    expect(priv).toMatch(/If you turn on check-ins/);
    expect(priv).toMatch(/not in the app yet/i);
    const terms = read('terms/index.html');
    expect(terms).toMatch(/Australian Consumer Law/);
    expect(terms).toMatch(/laws of Queensland/);
  });
});

describe('coverage wording', () => {
  it('never promises the Gold Coast or Sunshine Coast; says South-East Queensland starting around Brisbane', () => {
    for (const p of [...PAGES, ...LEGAL]) expect(read(p), p).not.toMatch(/gold coast|sunshine coast/i);
    for (const p of PAGES) expect(read(p), p).toMatch(/South-East Queensland/);
    expect(read('index.html')).toMatch(/starting around Brisbane/);
    expect(read('business/index.html')).toMatch(/starting around Brisbane/);
    expect(read('business/index.html')).toMatch(/Brisbane, Logan and Moreton Bay/);
  });
});
