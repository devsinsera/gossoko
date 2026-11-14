import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loginTarget } from '@/site/login';
import { signedIn } from '@/site/home';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('site layout: /gossoko/ website, /gossoko/admin/ app, /gossoko/login/ sign-in', () => {
  it('the login address moves on to the right screen', () => {
    expect(loginTarget({ search: '', hash: '' }, false)).toBe('/gossoko/admin/login');
    expect(loginTarget({ search: '', hash: '#start' }, false)).toBe('/gossoko/admin/signup');
    expect(loginTarget({ search: '', hash: '' }, true)).toBe('/gossoko/admin/');
    expect(loginTarget({ search: '', hash: '#access_token=x&type=recovery' }, false)).toBe('/gossoko/admin/auth/confirm#access_token=x&type=recovery');
  });
  it('knows a signed-in browser by the app session key, and survives a blocked store', () => {
    expect(signedIn({ getItem: (k) => (k === 'gossoko.auth' ? '{}' : null) })).toBe(true);
    expect(signedIn({ getItem: () => null })).toBe(false);
    expect(signedIn({ getItem: () => { throw new Error('blocked'); } })).toBe(false);
  });
  it('the website has Log in and Get started, and never links the bare folder as the app', () => {
    const home = read('index.html');
    expect(home).toContain('href="/gossoko/login/" data-login');
    expect(home).toContain('href="/gossoko/login/#start"');
    expect(home).toContain('id="shops"');
    for (const p of ['index.html', 'business/index.html']) expect(read(p)).not.toMatch(/href="\/gossoko\/(nearby|rankings|search|venue\/new)"/);
  });
  it('the app is not indexed, runs under /gossoko/admin, and staff pages are not at admin/admin', () => {
    expect(read('admin/index.html')).toContain('name="robots" content="noindex"');
    const app = read('src/App.tsx');
    expect(app).toContain('basename={APP_BASE');
    expect(app).toContain('<Route path="staff"');
    expect(app).not.toContain('"/admin/');
    expect(read('src/lib/env.ts')).toContain('admin/`');
  });
  it('old app links are sent into the app, and the phone shells open the app', () => {
    const ht = read('public/.htaccess');
    expect(ht).toContain('RewriteRule ^admin/ /gossoko/admin/index.html [L]');
    expect(ht).toContain('RewriteRule ^(.+)$ /gossoko/admin/$1 [R=302,L,QSA]');
    expect(JSON.parse(read('native/capacitor.config.json')).server.url).toBe('https://sinsera.co/gossoko/admin/');
    expect(JSON.parse(read('public/manifest.webmanifest')).start_url).toBe('/gossoko/admin/');
  });
});
