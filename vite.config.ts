import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { nativeGuardScript } from './src/site/native';
import { contactLink } from './src/config/site';

const BASE = '/gossoko/';
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
      if (!html.includes(GUARD_MARK)) return html;
      return html
        .replace(GUARD_MARK, `<script>${nativeGuardScript(BASE)}</script>`)
        .split('__CONTACT_HREF__').join(contact.href)
        .split('__CONTACT_CTA__').join(contact.cta)
        .split('__CONTACT_LABEL__').join(contact.label);
    },
  };
}

// Served from sinsera.co/gossoko/ — the deploy script derives its remote
// directory from this same base, so upload target and asset paths cannot drift.
// Three pages: the app (index.html) and the web-only sales site (about/, business/),
// which build to dist/about/index.html and dist/business/index.html.
export default defineConfig({
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
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        about: fileURLToPath(new URL('./about/index.html', import.meta.url)),
        business: fileURLToPath(new URL('./business/index.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
