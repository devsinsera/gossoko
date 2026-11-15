import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { nativeGuardScript } from './src/site/native';
import { contactLink, legalTokens } from './src/config/site';

const BASE = '/gossoko/';
const APP_HOME = '/gossoko/admin/';
const GUARD_MARK = '<!-- gossoko:native-guard -->';

/**
 * The sales pages (about/, business/): inlines the native-shell guard into their <head>
 * (src/site/native.ts) and fills in the contact link (src/config/site.ts).
 */
function nativeGuard(): Plugin {
  const contact = contactLink(BASE);
  return {
    name: 'gossoko-native-guard',
    transformIndexHtml(html) {
      // Legal pages (privacy/, terms/) carry no price and must open inside the apps, so they get
      // the entity tokens but NOT the native guard.
      let out = html;
      for (const [k, v] of Object.entries(legalTokens())) out = out.split(k).join(v);
      if (!out.includes(GUARD_MARK)) return out;
      return out
        .replace(GUARD_MARK, `<script>${nativeGuardScript(APP_HOME)}</script>`)
        .split('__CONTACT_HREF__').join(contact.href)
        .split('__CONTACT_CTA__').join(contact.cta)
        .split('__CONTACT_LABEL__').join(contact.label);
    },
  };
}

// Layout (Peta, 14 Nov 2026): /gossoko/ = the website (index.html), /gossoko/admin/ = the app
// (admin/index.html, router basename /gossoko/admin), /gossoko/login/ = sign-in (moves on to the app).
// Served from sinsera.co/gossoko/ — the deploy script derives its remote
// directory from this same base, so upload target and asset paths cannot drift.
// The app (index.html), the web-only sales site (about/, business/) and the legal pages
// (privacy/, terms/ — shown in the apps too), each built to dist/<name>/index.html.
export default defineConfig(({ command, mode }) => {
  // A build without the Supabase keys cannot sign in ("Gossoko is not configured") and `npm run deploy`
  // would put it live: tests pass without them. It happens when building from a git worktree, which has
  // no .env.local (Callout's Mac app, 15 Nov). Refuse instead of shipping it — same guard as Callout.
  if (command === 'build' && !process.env.VITEST) {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((k) => !env[k]);
    if (missing.length) throw new Error(`Refusing to build Gossoko without ${missing.join(' and ')} — copy .env.local from the main Gossoko checkout.`);
  }
  return {
  plugins: [react(), nativeGuard()],
  base: '/gossoko/',
  server: { port: 4780, host: '127.0.0.1' },
  preview: { port: 4780, host: '127.0.0.1' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
        login: fileURLToPath(new URL('./login/index.html', import.meta.url)),
        business: fileURLToPath(new URL('./business/index.html', import.meta.url)),
        privacy: fileURLToPath(new URL('./privacy/index.html', import.meta.url)),
        terms: fileURLToPath(new URL('./terms/index.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
};
});
