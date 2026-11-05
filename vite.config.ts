import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Served from sinsera.co/gossoko/ — the deploy script derives its remote
// directory from this same base, so upload target and asset paths cannot drift.
export default defineConfig({
  plugins: [react()],
  base: '/gossoko/',
  server: { port: 4780, host: '127.0.0.1' },
  preview: { port: 4780, host: '127.0.0.1' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
