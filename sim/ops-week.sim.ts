// Gossoko — one launch week of OPERATIONS, as it is set up on live (15 Nov 2026):
//   * pre-moderation ON (every review/comment waits for staff), one admin (Peta) who checks
//     the staff queue at lunch (12:30) and in the evening (20:30), no other moderators;
//   * the seed venues, real owners claiming, Free deals, codes at the counter, replies,
//     a rival's mates reporting a fair review, a spammer, an account deletion, the Monday digest.
// Drives the app's own code (src/) against the isolated sim stack, like six-months.sim.ts.
// Run: SIM_ANON=… npx vitest run -c sim/vitest.config.ts sim/ops-week.sim.ts   (stack from sim/run.sh up)
// Writes sim/report-ops-week.json (or SIM_OUT). Every FAULT line is something a real person would hit.
import { test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const DB = process.env.SIM_DB ?? 'postgresql://postgres:postgres@127.0.0.1:55422/postgres';
const FN = process.env.SIM_FN ?? 'http://127.0.0.1:55430';
const JWT_SECRET = process.env.SIM_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long';
const OUT = process.env.SIM_OUT ?? 'sim/report-ops-week.json';

(globalThis as any).window ??= new EventTarget();
(globalThis as any).window.location ??= { origin: 'https://sinsera.co' };
class MemStore { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, String(v)); } removeItem(k: string) { this.m.delete(k); } clear() { this.m.clear(); } }
(globalThis as any).localStorage ??= new MemStore();
(globalThis as any).sessionStorage ??= new MemStore();
const realFetch = globalThis.fetch;
globalThis.fetch = (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.includes('/functions/v1/gossoko-admin')) return realFetch(FN, init);
  return realFetch(input, init);
};
const appErrors: string[] = [];
console.error = (...a: unknown[]) => { appErrors.push(a.map(String).join(' ')); };
console.warn = (...a: unknown[]) => { appErrors.push('[warn] ' + a.map(String).join(' ')); };

const sql = (q: string) => execFileSync('psql', [DB, '-AtqX', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
const rows = (q: string) => { const o = execFileSync('psql', [DB, '-AtqX', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim(); return o ? o.split('\n').map((l) => l.split('\t')) : []; };
function jwt(sub: string, email: string) {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub, email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 86400 * 7 })}`;
  return `${body}.${createHmac('sha256', JWT_SECRET).update(body).digest('base64url')}`;
}
let seed = 20261115;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];

async function loadApp() {
  return {
    client: await import('@/lib/supabase/client'),
    auth: await import('@/lib/api/auth'),
    venues: await import('@/lib/queries/venues'),
    reviews: await import('@/lib/queries/reviews'),
    submitReview: (await import('@/pages/review/new/actions')).submitReview,
    submitVenue: (await import('@/pages/venue/new/actions')).submitVenue,
    addComment: (await import('@/pages/_comments/actions')).addComment,
    report: (await import('@/pages/_report/actions')).reportContent,
    claim: (await import('@/pages/_claims/actions')).claimVenue,
    mod: await import('@/pages/staff/moderation/actions'),
    biz: await import('@/pages/_business/actions'),
    bq: await import('@/lib/queries/business'),
    adminApi: await import('@/lib/api/admin'),
  };
}
let app: Awaited<ReturnType<typeof loadApp>>;

interface P { id: string; email: string; username: string; token: string; joinedAt: number }
const people: P[] = [];
async function as(p: P | null) {
  const sb = app.client.supabase();
  if (!p) { await sb.auth.signOut({ scope: 'local' }); return; }
  const { error } = await sb.auth.setSession({ access_token: p.token, refresh_token: 'sim-' + p.id });
  if (error) throw new Error(`setSession ${p.username}: ${error.message}`);
}
async function join(name: string, at: number): Promise<P> {
  const email = `ops.${people.length}@example.test`;
  await as(null);
  const r = await app.auth.signupUser(email, 'Tradie2026!sim', name);
  if (!r.success) throw new Error(`sign-up ${name}: ${r.errors?.join('; ')}`);
  const { data } = await app.client.supabase().auth.getUser();
  await app.auth.ensureProfile(data.user!);
  const p = { id: data.user!.id, email, username: name, token: jwt(data.user!.id, email), joinedAt: at };
  people.push(p);
  return p;
}
const form = (o: Record<string, string | number>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, String(v)); return f; };
const stars = (n: number) => Object.fromEntries(['coffee_strength_rating', 'feed_size_rating', 'bang_for_buck_rating', 'speed_rating', 'ute_parking_rating', 'early_open_rating', 'service_rating'].map((k) => [k, n]));

// ── the week's clock: hour 0 = Monday 00:00 ─────────────────────────────────
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const when = (h: number) => `${DAY[Math.floor(h / 24)]} ${String(Math.floor(h % 24)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const ROUNDS = [12.5, 20.5];               // Peta looks at the staff queue at lunch and after tea
const findings: { at: string; area: string; kind: 'FAULT' | 'OK' | 'NOTE'; what: string }[] = [];
const fault = (h: number, area: string, what: string) => findings.push({ at: when(h), area, kind: 'FAULT', what });
const ok = (h: number, area: string, what: string) => findings.push({ at: when(h), area, kind: 'OK', what });
const note = (h: number, area: string, what: string) => findings.push({ at: when(h), area, kind: 'NOTE', what });
const posted = new Map<string, number>();  // review id → sim hour posted
const waits: number[] = [];

async function staffRound(admin: P, h: number) {
  await as(admin);
  for (const [id, body] of rows(`select id, body from gossoko.reviews where moderation_status = 'pending' and deleted_at is null`)) {
    const spam = /bootdeals|crypto|0400 000 000|link in bio/i.test(body);
    try { await app.mod.resolveReviewSubmission({ id, decision: spam ? 'rejected' : 'approved' }); }
    catch (e) { fault(h, 'moderation', `review decision failed: ${(e as Error).message}`); }
    if (posted.has(id)) { waits.push(h - posted.get(id)!); posted.delete(id); }
  }
  for (const [id, body] of rows(`select id, body from gossoko.comments where moderation_status = 'pending' and deleted_at is null`)) {
    try { await app.mod.resolveCommentSubmission({ id, decision: /bootdeals|crypto|idiot|grub/i.test(body) ? 'rejected' : 'approved' }); }
    catch (e) { fault(h, 'moderation', `comment decision failed: ${(e as Error).message}`); }
  }
  for (const [id] of rows(`select id from gossoko.venue_claims where status = 'pending' and deleted_at is null`)) {
    try { await app.mod.resolveVenueClaim({ id, decision: 'approved', notes: 'rang the shop' }); }
    catch (e) { fault(h, 'claims', `claim approval failed: ${(e as Error).message}`); }
  }
  for (const [id, name] of rows(`select id, name from gossoko.venues where moderation_status = 'pending' and deleted_at is null`)) {
    try { await app.mod.resolveVenueSubmission({ id, decision: /FREE|crypto/i.test(name) ? 'rejected' : 'approved' }); }
    catch (e) { fault(h, 'moderation', `venue decision failed: ${(e as Error).message}`); }
  }
  // Report queue: Peta reads each one and keeps fair content (decision "approved" = content stays up).
  for (const [id, type, cid] of rows(`select id, content_type, content_id from gossoko.moderation_queue where status = 'pending'`)) {
    const fair = type === 'review' && sql(`select coalesce((select body from gossoko.reviews where id = '${cid}'), '')`).includes('cold in the middle');
    try { await app.mod.resolveQueueItem({ id, decision: fair ? 'approved' : 'hidden', notes: fair ? 'fair review' : 'spam' }); }
    catch (e) { fault(h, 'moderation', `queue decision failed: ${(e as Error).message}`); }
  }
}

test('Gossoko — one launch week of operations (live settings)', async () => {
  app = await loadApp();
  sql(`update gossoko.app_settings set value = 'true' where key = 'review_premoderation'`);   // as on live
  const venues = rows(`select id, name, slug from gossoko.venues where moderation_status = 'approved' and deleted_at is null order by name limit 18`);
  const admin = await join('Peta_owner', 0);
  sql(`update gossoko.profiles set role = 'admin' where id = '${admin.id}'`);

  // ── Monday: flyers went out on the weekend. Owners and tradies sign up before work. ──
  const owners: P[] = [];
  for (let i = 0; i < 6; i++) owners.push(await join(`Owner_${['Dee', 'Sam', 'Kel', 'Robbo', 'Mel', 'Tony'][i]}`, 5));
  const tradies: P[] = [];
  for (let i = 0; i < 60; i++) tradies.push(await join(`${pick(['Dave', 'Shane', 'Bec', 'Jono', 'Mick', 'Tash', 'Gaz', 'Steph', 'Lachie', 'Jess'])}_${pick(['sparky', 'chippy', 'plumber', 'tiler', 'brickie', 'roofer'])}${i}`, 5 + i / 30));
  const ownerVenue = new Map<string, { id: string; name: string; slug: string }>();
  for (const [i, o] of owners.entries()) {
    await as(o);
    const v = { id: venues[i][0], name: venues[i][1], slug: venues[i][2] };
    const out = await app.claim(v.id);
    if (out !== 'submitted') fault(6, 'claims', `${o.username} could not claim ${v.name}: ${out}`);
    ownerVenue.set(o.id, v);
  }
  note(6, 'claims', 'a claim asks for nothing (no ABN, phone, photo or note); Peta has to ring each shop to check — the staff page shows only name + venue');

  // Monday 05:00–07:00: first reviews, all held by pre-moderation.
  let rev = 0;
  for (const t of tradies.slice(0, 25)) {
    await as(t);
    const v = pick(venues);
    const h = 5 + rnd() * 2;
    const good = rnd() < 0.75;
    const r = await app.submitReview(form({ venue_id: v[0], title: good ? 'Solid smoko' : 'Cold pie', body: good ? 'Coffee strong and in and out in four minutes.' : 'Sausage roll was cold in the middle and waited 15 min.', ...stars(good ? 4 : 2) }));
    if (!r.ok) { fault(h, 'reviews', `review refused: ${r.error}`); continue; }
    rev++;
    const id = sql(`select id from gossoko.reviews where user_id = '${t.id}' order by created_at desc limit 1`);
    if (r.pending) posted.set(id, h);
  }
  await as(null);
  const shownMon = (await app.venues.getAllVenues()).reduce((n, v) => n + v.review_count, 0);
  if (shownMon === 0 && rev > 0) note(7, 'reviews', `${rev} reviews posted before work, none visible: every launch-morning reviewer sees an empty app until Peta's lunch round`);

  // A spammer and a hothead, Monday.
  const spammer = await join('deals_bot', 9);
  await as(spammer);
  await app.submitReview(form({ venue_id: venues[3][0], title: 'Best deals', body: 'CHEAP STEEL CAPS 80% OFF visit bootdeals.example', ...stars(5) }));
  posted.set(sql(`select id from gossoko.reviews where user_id = '${spammer.id}' order by created_at desc limit 1`), 9);

  for (const h of ROUNDS) await staffRound(admin, h);
  const managed = await Promise.all(owners.map(async (o) => { await as(o); return (await app.bq.getManagedVenues(o.id)).length; }));
  if (managed.every((n) => n === 1)) ok(12.5, 'claims', 'all six claims approved at the lunch round; owners see My Venues');
  const notes = Number(sql(`select count(*) from gossoko.notifications where type = 'review'`));
  note(20.5, 'alerts', `${notes} "new review" alerts went to owners on Monday (sent at approval time, not posting time); push tokens: ${sql(`select count(*) from gossoko.push_tokens`)}`);

  // ── Tuesday: Dee posts a 7-day deal at 05:30. Tradies grab codes at the counter. ──
  const dee = owners[0], deeVenue = ownerVenue.get(dee.id)!;
  await as(dee);
  const d1 = await app.biz.createDeal({ venueId: deeVenue.id, title: 'Pie + coffee $9 before 7', description: 'Show your code at the counter.', terms: 'One per customer', kind: 'other', value: 0, hours: 24 * 7, maxRedemptions: null });
  if (!d1.ok) fault(29.5, 'deals', `Dee could not post her deal: ${d1.error}`);
  const deal1 = sql(`select id from gossoko.venue_specials where venue_id = '${deeVenue.id}' order by created_at desc limit 1`);
  let redeemed = 0, codeFail = 0;
  for (const t of tradies.slice(0, 20)) {
    await as(t);
    const c = await app.biz.claimDealCode(deal1);
    if (!c.ok) { codeFail++; continue; }
    await as(dee);
    const r = await app.biz.redeemDealCode(deeVenue.id, c.code);
    if (r.ok) redeemed++; else fault(30, 'deals', `counter could not redeem ${c.code}: ${r.error}`);
  }
  if (redeemed === 20) ok(30, 'deals', '20 codes claimed and redeemed at the counter, none refused');
  else note(30, 'deals', `${redeemed}/20 codes redeemed, ${codeFail} refused at claim`);

  // ── Wednesday: Dee's supplier puts pies up. She ends the $9 deal and posts $10. ──
  await as(dee);
  const end = await app.biz.endDeal(deal1);
  if (!end.ok) fault(53, 'deals', `"End deal" refused for the verified owner: "${end.error}" — the database rejects the soft-delete (RLS: the row must stay visible to the SELECT policy, which hides deleted deals)`);
  const d2 = await app.biz.createDeal({ venueId: deeVenue.id, title: 'Pie + coffee $10 before 7', description: '', terms: '', kind: 'other', value: 0, hours: 24 * 7, maxRedemptions: null });
  if (!d2.ok) fault(53, 'deals', `Dee is stuck: new deal refused ("${d2.error}") — the old $9 price stays on the app until it lapses Tuesday next week`);

  // Wednesday: Sam updates his hours (closed Sundays). The app has one daily window only.
  const sam = owners[1], samVenue = ownerVenue.get(sam.id)!;
  await as(sam);
  const s = await app.biz.saveVenueDetails(samVenue.id, { tagline: 'Early start, strong brew', description: 'Closed Sundays.', phone: '07 3000 1234', opens_at: '04:30', closes_at: '13:00' });
  if (!s.ok) fault(54, 'listing', `Sam could not save his hours: ${s.error}`);
  else note(54, 'listing', 'hours are ONE daily window: "closed Sundays" or "Sat 6–11" can only go in the description; the app still says "Open now" on Sunday at 05:00');

  // ── Thursday: a fair 2-star review on Kel's place; Kel's mates report it. ──
  const kel = owners[2], kelVenue = ownerVenue.get(kel.id)!;
  const critic = tradies[40];
  await as(critic);
  const fairR = await app.submitReview(form({ venue_id: kelVenue.id, title: 'Cold pie', body: 'Sausage roll was cold in the middle and waited 15 min.', ...stars(2) }));
  const fairId = sql(`select id from gossoko.reviews where user_id = '${critic.id}' and venue_id = '${kelVenue.id}' limit 1`);
  if (fairR.ok && fairR.pending) posted.set(fairId, 77);
  await staffRound(admin, 84.5);
  // Kel's three mates joined Monday (accounts now > 3 days old) and all report it at 21:00.
  sql(`update gossoko.profiles set created_at = now() - interval '4 days' where id in ('${tradies[41].id}','${tradies[42].id}','${tradies[43].id}')`);
  for (const mate of tradies.slice(41, 44)) {
    await as(mate);
    await app.report({ reportableType: 'review', reportableId: fairId, reportType: 'spam', reason: 'fake review from a competitor' });
  }
  const hidden = sql(`select moderation_status from gossoko.reviews where id = '${fairId}'`);
  if (hidden === 'flagged') fault(93, 'moderation', 'three friends of the owner hid a fair 2-star review instantly (community auto-hide); it stays hidden until Peta\'s next round — no check that reporters are linked to the venue');
  // The same mate reports it 10 more times — every one lands in Peta's queue.
  await as(tradies[41]);
  for (let i = 0; i < 10; i++) await app.report({ reportableType: 'review', reportableId: fairId, reportType: 'spam', reason: 'fake fake fake' });
  const q = Number(sql(`select count(*) from gossoko.moderation_queue where content_id = '${fairId}' and status = 'pending'`));
  if (q > 3) fault(93, 'moderation', `one person reported the same review 11 times: ${q} queue items for one review (no one-report-per-person rule)`);
  await staffRound(admin, 108.5);  // Thursday's evening round had passed: next look is Friday lunch
  const back = sql(`select moderation_status from gossoko.reviews where id = '${fairId}'`);
  if (back === 'approved') ok(108.5, 'moderation', 'Peta kept the fair review; resolving the queue put it back');
  else fault(108.5, 'moderation', `after Peta kept the review it is still ${back}`);

  // Thursday: Kel replies to the review, nicely.
  await as(kel);
  const rep = await app.biz.postReply(fairId, 'Sorry mate, the warmer was playing up — next one is on us.');
  if (!rep.ok) fault(110, 'replies', `owner reply failed: ${rep.error}`);

  // ── Friday: a customer adds a new food van; it waits for staff. Robbo checks his dashboard. ──
  const adder = tradies[50];
  await as(adder);
  const nv = await app.submitVenue(form({ name: 'Ute Stop Coffee Van', suburb: 'Wacol', state: 'QLD', address: '12 Industrial Dr', type: 'food_truck', tagline: 'Wacol tradie stop', opens_at: '05:00', closes_at: '11:00', price_level: 1, latitude: '-27.5900', longitude: '152.9300' }));
  if (!nv.ok) fault(100, 'venues', `add venue failed: ${nv.error}`);
  await staffRound(admin, 116.5);
  const robbo = owners[3], robboVenue = ownerVenue.get(robbo.id)!;
  // Robbo opens his own venue page from his phone, his iPad and the shop PC each morning.
  for (let d = 0; d < 4; d++) for (const dev of ['phone', 'ipad', 'pc']) {
    await as(null);
    await app.client.supabase().rpc('track_venue_event', { p_venue: robboVenue.id, p_kind: 'view', p_actor: `robbo-${dev}-${d}` });
  }
  await as(robbo);
  const st = await app.bq.getVenueStats(robboVenue.id, 30);
  if (st && st.views >= 4) note(110, 'stats', `Robbo's dashboard shows ${st.views} views today — at least 3 are his own devices (owners and staff are counted; signed-out views trust a device id the browser sends)`);

  // ── Saturday: a tradie deletes their account. ──
  const leaver = tradies[5];
  await as(leaver);
  const del = await app.adminApi.deleteMyAccount();
  if (!del.ok) fault(130, 'accounts', `account deletion failed: ${del.error}`);
  else {
    const left = sql(`select (select count(*) from gossoko.profiles where id = '${leaver.id}') + (select count(*) from auth.users where id = '${leaver.id}')`);
    if (left === '0') note(130, 'accounts', 'deleting a Gossoko account deletes the shared sinsera.co login (auth.users) — the same login their other Sinsera apps use');
  }

  // ── Sunday: the Monday 7am digest. ──
  const digest = rows(`select email, venue_name, views, saves, new_reviews from gossoko.weekly_digest_rows()`);
  note(160, 'digest', `${digest.length} owner emails queued for Monday; sends only when SMTP secrets exist (they don't: noreply@ password wrong) and needs a scheduler (no cron row found in the migrations)`);

  // ── whole-week numbers ──
  for (const [id, h] of posted) { waits.push(168 - h); void id; }
  waits.sort((a, b) => a - b);
  const p50 = waits[Math.floor(waits.length / 2)] ?? 0, max = waits[waits.length - 1] ?? 0;
  if (max > 12) fault(168, 'moderation', `with pre-moderation on and one moderator, reviews waited a median ${p50.toFixed(1)} h and up to ${max.toFixed(1)} h before anyone could see them`);

  const report = {
    simulated: 'launch week, live settings (pre-moderation ON, one admin, rounds 12:30 + 20:30)',
    people: people.length, reviews: Number(sql(`select count(*) from gossoko.reviews`)),
    moderationWaitHours: { median: +p50.toFixed(1), max: +max.toFixed(1), n: waits.length },
    findings, appErrors: [...new Set(appErrors)].slice(0, 30),
  };
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  process.stderr.write(findings.map((f) => `${f.kind.padEnd(5)} ${f.at}  [${f.area}] ${f.what}`).join('\n') + `\n[ops-week] → ${OUT}\n`);
});
