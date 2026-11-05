// Quick UI smoke against the isolated stack: opens the main screens in a real browser, fails on any
// console error or uncaught exception, and saves a few screenshots to eyeball.
// Needs: sim/run.sh up (+ some data, e.g. SIM_DAYS=100 sim/run.sh), then: node sim/ui-smoke.mjs
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PW = process.env.PLAYWRIGHT_PATH ?? `${process.env.HOME}/Dev-Sinsera/Sinsera Core/Ui/node_modules/playwright/index.mjs`;
const { chromium } = await import(PW);
const DB = process.env.SIM_DB ?? 'postgresql://postgres:postgres@127.0.0.1:55422/postgres';
const API = 'http://127.0.0.1:55421';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const OUT = process.env.SMOKE_OUT ?? 'sim/shots';
const PORT = 4791;
const q = (s) => execFileSync('psql', [DB, '-AtqX', '-F', '|', '-c', s], { encoding: 'utf8' }).trim();

mkdirSync(OUT, { recursive: true });
const dev = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: API, VITE_SUPABASE_ANON_KEY: ANON }, stdio: 'ignore',
});
const cleanup = () => { try { dev.kill(); } catch { /* gone */ } };
process.on('exit', cleanup);
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/gossoko/`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }

const owner = q(`select p.email || '|' || v.slug from gossoko.venue_claims c join gossoko.profiles p on p.id = c.user_id join gossoko.venues v on v.id = c.venue_id where c.status = 'approved' limit 1`).split('|');
const tradie = q(`select email from gossoko.profiles where role = 'user' and email like 'sim%' order by created_at limit 1`);
const venueSlug = q(`select slug from gossoko.venues where moderation_status = 'approved' order by review_count desc limit 1`);
const failures = [];

const browser = await chromium.launch();
async function session(email) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: -27.46, longitude: 153.04 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('UNCAUGHT ' + e.message));
  if (email) {
    await page.goto(`http://127.0.0.1:${PORT}/gossoko/login`);
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', 'Tradie2026!sim');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 });
  }
  return { page, errs, ctx };
}
async function visit(s, path, expects, shot) {
  await s.page.goto(`http://127.0.0.1:${PORT}/gossoko${path}`);
  await s.page.waitForLoadState('networkidle');
  await s.page.waitForTimeout(400);
  const body = await s.page.locator('body').innerText();
  for (const e of expects) if (!body.toLowerCase().includes(e.toLowerCase())) failures.push(`${path}: missing "${e}"`);
  if (shot) await s.page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
}

const anon = await session(null);
await visit(anon, '/', ['Gossoko'], 'feed-anon');
await visit(anon, '/nearby', ['Nearby'], null);
await visit(anon, '/rankings', ['Rankings'], null);
await visit(anon, '/search', ['Search'], null);
await visit(anon, '/deals', ['Deals'], 'deals');
await visit(anon, `/venue/${venueSlug}`, ['Ratings Breakdown', 'Own this venue'], 'venue-anon');
await visit(anon, '/manage', [], null);
failures.push(...anon.errs.map((e) => `anon console: ${e}`));

const t = await session(tradie);
await visit(t, '/profile', ['Saved Spots', 'Edit profile', 'Delete my account'], 'profile');
await visit(t, `/venue/${venueSlug}`, ['Save'], null);
failures.push(...t.errs.map((e) => `tradie console: ${e}`));

const o = await session(owner[0]);
await visit(o, `/manage/${owner[1]}`, ['How it', 'Check a code', 'Deals', 'Counter QR', 'Your listing', 'Plan'], 'manage');
await visit(o, `/venue/${owner[1]}`, ['Open your dashboard'], null);
failures.push(...o.errs.map((e) => `owner console: ${e}`));

await browser.close();
cleanup();
if (failures.length) { console.log('UI SMOKE FAILED:\n' + [...new Set(failures)].join('\n')); process.exit(1); }
console.log(`UI smoke OK — screenshots in ${OUT}`);
