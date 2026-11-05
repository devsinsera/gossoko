// Six-month operation simulation. Runs the app's own data code (src/) against an
// isolated local Supabase started by sim/up.sh — never the live project.
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['sim/**/*.sim.ts'],
    testTimeout: 0,
    hookTimeout: 0,
    env: {
      VITE_SUPABASE_URL: process.env.SIM_API ?? 'http://127.0.0.1:55421',
      VITE_SUPABASE_ANON_KEY: process.env.SIM_ANON ?? '',
    },
  },
});
