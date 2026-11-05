// Gossoko — six months of operation, compressed.
//
// Drives the app's real data code (sign-up, reviews, helpful, comments, reports,
// new venues, claims, admin moderation) as a growing crowd of Brisbane tradies,
// venue owners, spammers and two moderators, one simulated day at a time. After
// each day every new row is backdated to that day, so the database ends up
// looking like 7 May → 4 Nov 2026. Then it checks what people would actually see.
//
// Run: sim/run.sh   (starts the isolated stack, runs this, prints the report)
import { test, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const DB = process.env.SIM_DB ?? 'postgresql://postgres:postgres@127.0.0.1:55422/postgres';
const FN = process.env.SIM_FN ?? 'http://127.0.0.1:55430';
const JWT_SECRET = process.env.SIM_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long';
const DAYS = Number(process.env.SIM_DAYS ?? 182);
const START = new Date('2026-05-07T12:00:00+10:00');
const OUT = process.env.SIM_OUT ?? 'sim/report.json';

// ── plumbing ────────────────────────────────────────────────────────────────
(globalThis as any).window ??= new EventTarget();
(globalThis as any).window.location ??= { origin: 'https://sinsera.co' };
// The phone app keeps its session in web storage; give Node an in-memory one.
class MemStore { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, String(v)); } removeItem(k: string) { this.m.delete(k); } clear() { this.m.clear(); } }
(globalThis as any).localStorage ??= new MemStore();
(globalThis as any).sessionStorage ??= new MemStore();

// The local stack has no edge runtime; send gossoko-admin calls to the Deno container.
const realFetch = globalThis.fetch;
globalThis.fetch = (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.includes('/functions/v1/gossoko-admin')) return realFetch(FN, init);
  return realFetch(input, init);
};

const appErrors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => { appErrors.push(a.map(String).join(' ')); };
console.warn = (...a: unknown[]) => { appErrors.push('[warn] ' + a.map(String).join(' ')); };

function sql(q: string): string {
  return execFileSync('psql', [DB, '-AtqX', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
}
function sqlRows(q: string): string[][] {
  const out = execFileSync('psql', [DB, '-AtqX', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
  return out ? out.split('\n').map((l) => l.split('\t')) : [];
}

function jwt(sub: string, email: string): string {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b({ alg: 'HS256', typ: 'JWT' })}.${b({
    sub, email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 86400 * 7,
  })}`;
  return `${body}.${createHmac('sha256', JWT_SECRET).update(body).digest('base64url')}`;
}

// Seeded RNG so a re-run reproduces the same six months.
let seed = Number(process.env.SIM_SEED ?? 20261105);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const chance = (p: number) => rnd() < p;
const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

// ── app modules (imported after env is set; re-imported when pre-moderation flips) ──
type App = Awaited<ReturnType<typeof loadApp>>;
async function loadApp() {
  return {
    client: await import('@/lib/supabase/client'),
    auth: await import('@/lib/api/auth'),
    venues: await import('@/lib/queries/venues'),
    reviews: await import('@/lib/queries/reviews'),
    comments: await import('@/lib/queries/comments'),
    profile: await import('@/lib/queries/profile'),
    submitReview: (await import('@/pages/review/new/actions')).submitReview,
    submitVenue: (await import('@/pages/venue/new/actions')).submitVenue,
    addComment: (await import('@/pages/_comments/actions')).addComment,
    toggleHelpful: (await import('@/pages/_likes/actions')).toggleHelpful,
    report: (await import('@/pages/_report/actions')).reportContent,
    claim: (await import('@/pages/_claims/actions')).claimVenue,
    deleteReview: (await import('@/pages/profile/actions')).deleteReview,
    mod: await import('@/pages/admin/moderation/actions'),
  };
}

// ── the cast ────────────────────────────────────────────────────────────────
type Kind = 'tradie' | 'lurker' | 'owner' | 'spammer' | 'admin' | 'moderator';
interface Person { id: string; email: string; username: string; kind: Kind; token: string; joined: number; activity: number; hasProfile: boolean; }

const FIRST = ['Dave', 'Shane', 'Bec', 'Jono', 'Mick', 'Tash', 'Brodie', 'Kel', 'Gaz', 'Steph', 'Lachie', 'Jess', 'Tony', 'Mel', 'Robbo', 'Sam', 'Nat', 'Hayden', 'Kirra', 'Darren', 'Liam', 'Ash', 'Tom', 'Jaz', 'Wayne'];
const TRADES = ['sparky', 'chippy', 'plumber', 'concreter', 'tiler', 'brickie', 'roofer', 'painter', 'landscaper', 'diesel_mech', 'scaffolder', 'plasterer'];
// Values the profiles.trade_type enum accepts (no tiler, brickie, painter, landscaper…).
const TRADE_ENUM = ['sparky', 'chippy', 'plumber', 'mechanic', 'builder', 'concreter', 'roofer', 'other'];
const SUBURBS: [string, number, number][] = [
  ['Eagle Farm', -27.43, 153.08], ['Pinkenba', -27.42, 153.12], ['Rocklea', -27.54, 152.99], ['Acacia Ridge', -27.58, 153.03],
  ['Yatala', -27.74, 153.23], ['Brendale', -27.32, 152.98], ['Coopers Plains', -27.56, 153.04], ['Geebung', -27.37, 153.05],
  ['Wacol', -27.59, 152.93], ['Murarrie', -27.46, 153.11], ['Narangba', -27.20, 152.96], ['Springfield', -27.67, 152.91],
];
const VENUE_WORDS = ['Smoko', 'Hi-Vis', 'Toolbox', 'Crane', 'Rebar', 'Level', 'Dropsaw', 'Ute', 'Formwork', 'Spirit Level', 'Knock-Off', 'Pallet'];
const VENUE_TAIL = ['Coffee', 'Bakery', 'Kitchen', 'Van', 'Express', 'Pies', 'Espresso', 'Canteen'];
const TYPES = ['cafe', 'food_truck', 'bakery', 'servo', 'gossoko_van', 'snack_bar'];

const GOOD = ['Coffee was strong enough to wake the dead', 'Pie was massive and hot at 5:40', 'In and out in four minutes', 'Plenty of room for the ute and trailer',
  'Bacon and egg roll done properly', 'Staff remember your order after a week', 'Open before the site gate, legend', 'Fair price for a proper feed'];
const BAD = ['Waited 15 min with three people ahead', 'Coffee tasted burnt again', 'Nowhere to park a ute with a trailer', 'Sausage roll was cold in the middle',
  'Shut at 6 even though the sign says 5', 'Small serve for the price', 'Card machine down, cash only'];
const SPAM = ['CHEAP STEEL CAPS 80% OFF visit bootdeals.example', 'Crypto for tradies, DM me, guaranteed returns', 'Best pies in Brisbane!!! call 0400 000 000 for wholesale',
  'Earn $500/day from your ute — link in bio'];
const ABUSE = ['this owner is a [slur removed] and a thief', 'staff are useless idiots, avoid', 'whoever wrote this review is a liar and a grub'];

const people: Person[] = [];
const venueTruth = new Map<string, number>();  // venue id → hidden "true quality" 1-5
const metrics: Record<string, any> = { daily: [] as any[] };
const issues = new Map<string, { count: number; first: string; example: string }>();
function issue(key: string, example: string, day: number) {
  const e = issues.get(key);
  if (e) e.count++; else issues.set(key, { count: 1, first: dayLabel(day), example });
}
const dayLabel = (d: number) => new Date(START.getTime() + d * 864e5).toISOString().slice(0, 10);

let app: App;
let runStart = '';
async function as(p: Person | null) {
  const sb = app.client.supabase();
  if (!p) { await sb.auth.signOut({ scope: 'local' }); return; }
  const { error } = await sb.auth.setSession({ access_token: p.token, refresh_token: 'sim-' + p.id });
  if (error) throw new Error(`setSession ${p.username}: ${error.message}`);
}

function form(o: Record<string, string | number>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, String(v));
  return f;
}

// Move every row created in real time today onto the simulated day.
const DATED = ['profiles', 'venues', 'reviews', 'comments', 'review_likes', 'content_reports', 'venue_claims', 'moderation_queue', 'audit_logs'];
function backdate(day: number) {
  const base = new Date(START.getTime() + day * 864e5).toISOString();
  const stmts = DATED.map((t) =>
    `update gossoko.${t} set created_at = '${base}'::timestamptz + interval '4 hours' + random() * interval '13 hours' where created_at >= '${runStart}'`);
  stmts.push(`update gossoko.reviews set updated_at = created_at where updated_at >= '${runStart}' and updated_at - created_at > interval '1 day' is not true`);
  sql(stmts.join(';\n'));
  // Stored scores/trending were computed from real-time dates; redo them on the simulated calendar.
  if (sql(`select to_regproc('gossoko.refresh_venue_stats') is not null`) === 't') {
    sql(`select gossoko.refresh_venue_stats(id) from gossoko.venues where id in (select venue_id from gossoko.reviews where updated_at >= '${runStart}' or created_at >= '${base}')`);
  }
}

// ── one person's visit ─────────────────────────────────────────────────────
async function visit(p: Person, day: number, timing: number[]) {
  await as(p);
  // Open the app: the feed loads every venue (as the home, Nearby, Search and Rankings pages do).
  const t0 = performance.now();
  const venues = await app.venues.getAllVenues();
  timing.push(performance.now() - t0);
  if (venues.length === 0) { issue('feed returned no venues for a signed-in user', p.username, day); return; }

  // Lean toward nearby/top venues like a real person scrolling.
  const v = chance(0.6) ? pick(venues.slice(0, 12)) : pick(venues);
  const venue = await app.venues.getVenueBySlug(v.slug);
  if (!venue) { issue('venue in the list but its page 404s', v.slug, day); return; }
  const revs = await app.reviews.getReviewsByVenueId(venue.id);
  const threads = await app.comments.getCommentsByReviewIds(revs.map((r) => r.id));
  const liked = await app.reviews.getUserLikedReviewIds(p.id, revs.map((r) => r.id));

  if (p.kind === 'lurker') return;

  if (p.kind === 'spammer') {
    if (chance(0.5)) {
      const res = await app.submitReview(form({ venue_id: venue.id, title: 'Must read!!!', body: pick(SPAM), ...stars(() => 5) }));
      if (res.ok) metrics.spamPosted = (metrics.spamPosted ?? 0) + 1;
    } else if (revs[0]) {
      const r = await app.addComment(pick(revs).id, pick([...SPAM, ...ABUSE]));
      if (r.ok) metrics.spamComments = (metrics.spamComments ?? 0) + 1;
    }
    if (chance(0.08)) await addVenue(p, day, true);
    return;
  }

  // Tradies and owners.
  for (const r of revs) {
    const isSpam = SPAM.some((s) => r.body.includes(s.slice(0, 20)));
    if (isSpam && chance(0.25)) {
      const out = await app.report({ reportableType: 'review', reportableId: r.id, reportType: 'spam', reason: 'Ad, not a review' });
      if (out !== 'submitted') issue(`report failed: ${out}`, r.id, day);
      else metrics.reports = (metrics.reports ?? 0) + 1;
    } else if (!isSpam && r.user_id !== p.id && chance(0.12)) {
      const was = liked.has(r.id);
      const res = await app.toggleHelpful(r.id, was);
      if (!res.ok) issue(`helpful failed: ${res.error}`, r.id, day);
    }
  }
  // Abusive or spammy comments get reported too.
  for (const list of threads.values()) {
    for (const c of list) {
      if (c.user_id !== p.id && [...SPAM, ...ABUSE].some((x) => c.body.includes(x.slice(0, 20))) && chance(0.2)) {
        const out = await app.report({ reportableType: 'comment', reportableId: c.id, reportType: 'offensive', reason: 'Abuse / spam in comments' });
        if (out !== 'submitted') issue(`comment report failed: ${out}`, c.id, day);
        else metrics.commentReports = (metrics.commentReports ?? 0) + 1;
      }
    }
  }
  if (revs.length && chance(0.07)) {
    const r = pick(revs);
    const res = await app.addComment(r.id, pick(['Spot on mate', 'Agree, the pies are elite', 'Went Tuesday, was fine for me', 'Parking is better round the back', 'They fixed the coffee machine']));
    if (!res.ok) issue(`comment failed: ${res.error}`, r.id, day);
  }

  const mine = revs.find((r) => r.user_id === p.id) ?? (await app.reviews.getReviewByUserAndVenue(p.id, venue.id));
  if (!mine && chance(p.kind === 'owner' ? 0.02 : 0.11)) {
    const q = venueTruth.get(venue.id) ?? 3.5;
    const happy = q + (rnd() - 0.5) * 1.6 >= 3.2;
    const res = await app.submitReview(form({
      venue_id: venue.id,
      title: happy ? pick(['Solid smoko stop', 'Go-to before site', 'Worth the detour']) : pick(['Hit and miss', 'Not again', 'Average at best']),
      body: `${pick(happy ? GOOD : BAD)}. ${pick(happy ? GOOD : BAD)}.`,
      ...stars(() => q + (rnd() - 0.5) * 1.8),
    }));
    if (res.ok) metrics.reviewsPosted = (metrics.reviewsPosted ?? 0) + 1;
    else issue(`review not saved: ${res.error}`, `${p.username} @ ${venue.slug}`, day);
  } else if (mine && chance(0.04)) {
    // Came back and changed their mind.
    const res = await app.submitReview(form({ venue_id: venue.id, review_id: mine.id, title: mine.title, body: mine.body + ' Update: better lately.', ...stars(() => mine.overall + 0.6) }));
    if (!res.ok) issue(`review edit failed: ${res.error}`, mine.id, day);
    else metrics.reviewEdits = (metrics.reviewEdits ?? 0) + 1;
  } else if (mine && chance(0.01)) {
    const res = await app.deleteReview(mine.id);
    if (!res.ok) issue(`review delete failed: ${res.error}`, mine.id, day);
    else metrics.reviewDeletes = (metrics.reviewDeletes ?? 0) + 1;
  }

  // Double-tap a second review on the same venue (should be refused, cleanly).
  if (mine && chance(0.01)) {
    const res = await app.submitReview(form({ venue_id: venue.id, title: 'Again', body: 'Posting twice by accident', ...stars(() => 4) }));
    if (res.ok) issue('second review on the same venue was accepted', venue.slug, day);
  }

  if (p.kind === 'tradie' && chance(0.012)) await addVenue(p, day, false);
}

function stars(f: () => number) {
  return {
    coffee_strength_rating: clamp(f()), feed_size_rating: clamp(f()), bang_for_buck_rating: clamp(f()),
    speed_rating: clamp(f()), ute_parking_rating: clamp(f()), early_open_rating: clamp(f()), service_rating: clamp(f()),
  };
}

async function addVenue(p: Person, day: number, fake: boolean) {
  const [suburb, lat, lng] = pick(SUBURBS);
  const name = fake ? pick(['FREE PIES CLICK HERE', 'Boot Deals Warehouse', 'Crypto Café']) : `${pick(VENUE_WORDS)} ${pick(VENUE_TAIL)}`;
  const res = await app.submitVenue(form({
    name, suburb, state: 'QLD', address: `${Math.floor(rnd() * 400) + 1} Industrial Dr`, type: pick(TYPES),
    tagline: fake ? 'best deals' : `${suburb} tradie stop`, opens_at: pick(['04:30', '05:00', '05:30', '06:00']), closes_at: pick(['13:00', '14:00', '15:00']),
    price_level: pick([1, 2, 2, 3]), latitude: (lat + (rnd() - 0.5) * 0.02).toFixed(5), longitude: (lng + (rnd() - 0.5) * 0.02).toFixed(5),
  }));
  if (!res.ok) { issue(`add venue failed: ${res.error}`, name, day); return; }
  metrics.venuesSubmitted = (metrics.venuesSubmitted ?? 0) + 1;
  const id = sql(`select id from gossoko.venues where created_by = '${p.id}' order by created_at desc limit 1`);
  venueTruth.set(id, fake ? 1 : 2 + rnd() * 3);
}

// ── moderators' rounds ───────────────────────────────────────────────────────
async function moderate(m: Person, day: number) {
  await as(m);
  // Venues waiting for approval.
  for (const [id, name] of sqlRows(`select id, name from gossoko.venues where moderation_status = 'pending' and deleted_at is null`)) {
    const fake = /FREE PIES|Boot Deals|Crypto/.test(name);
    try {
      await app.mod.resolveVenueSubmission({ id, decision: fake ? 'rejected' : 'approved' });
    } catch (e) { issue(`moderator venue decision failed: ${(e as Error).message}`, name, day); }
  }
  // Reported content.
  for (const [id, type, contentId] of sqlRows(`select id, content_type, content_id from gossoko.moderation_queue where status = 'pending'`)) {
    try { await app.mod.resolveQueueItem({ id, decision: 'hidden', notes: 'spam' }); }
    catch (e) { issue(`moderator queue decision failed: ${(e as Error).message}`, `${type} ${contentId}`, day); }
  }
  // Pending reviews/comments (only exist once pre-moderation is on).
  for (const [id, body] of sqlRows(`select id, body from gossoko.reviews where moderation_status = 'pending' and deleted_at is null`)) {
    const spam = SPAM.some((s) => body.includes(s.slice(0, 20)));
    try { await app.mod.resolveReviewSubmission({ id, decision: spam ? 'rejected' : 'approved' }); }
    catch (e) { issue(`moderator review decision failed: ${(e as Error).message}`, id, day); }
  }
  for (const [id, body] of sqlRows(`select id, body from gossoko.comments where moderation_status = 'pending' and deleted_at is null`)) {
    const bad = [...SPAM, ...ABUSE].some((s) => body.includes(s.slice(0, 20)));
    try { await app.mod.resolveCommentSubmission({ id, decision: bad ? 'rejected' : 'approved' }); }
    catch (e) { issue(`moderator comment decision failed: ${(e as Error).message}`, id, day); }
  }
  // Claims (ownership is admin-only).
  if (m.kind !== 'admin') return;
  for (const [id] of sqlRows(`select id from gossoko.venue_claims where status = 'pending' and deleted_at is null`)) {
    try { await app.mod.resolveVenueClaim({ id, decision: 'approved', notes: 'ABN checked' }); }
    catch (e) {
      const msg = (e as Error).message;
      if (/already has an approved owner/.test(msg)) {
        await app.mod.resolveVenueClaim({ id, decision: 'rejected', notes: 'Venue already has a verified owner' });
        metrics.claimsRejectedAsTaken = (metrics.claimsRejectedAsTaken ?? 0) + 1;
      } else issue(`admin claim decision failed: ${msg}`, id, day);
    }
  }
}

// ── sign-up ────────────────────────────────────────────────────────────────
async function join(kind: Kind, day: number): Promise<Person | null> {
  const n = people.length;
  // Real people pick short, common names — collisions happen.
  const username = kind === 'spammer' ? `deals_${n}` : chance(0.15) ? pick(FIRST) : `${pick(FIRST)}${chance(0.5) ? '_' + pick(TRADES) : Math.floor(rnd() * 99)}`;
  const email = `sim${n}.${day}@example.test`;
  await as(null);
  const res = await app.auth.signupUser(email, 'Tradie2026!sim', username);
  if (!res.success) { if (people.length === 0) origErr(res.errors); issue(`sign-up refused: ${res.errors?.join('; ')}`, username, day); return null; }
  const { data } = await app.client.supabase().auth.getUser();
  const id = data.user!.id;
  await app.auth.ensureProfile(data.user!);
  const hasProfile = sql(`select count(*) from gossoko.profiles where id = '${id}'`) === '1';
  if (!hasProfile) issue('account created but no profile (username taken?) — user cannot post', username, day);
  else sql(`update gossoko.profiles set trade_type = '${pick(TRADE_ENUM)}' where id = '${id}'`);
  const p: Person = { id, email, username, kind, token: jwt(id, email), joined: day, activity: 0.15 + rnd() * 0.5, hasProfile };
  people.push(p);
  return p;
}

// ── checks: what people actually see ─────────────────────────────────────────
async function checks(day: number) {
  await as(null);
  const shown = await app.venues.getAllVenues();
  const truth = new Map(sqlRows(`select venue_id, avg(overall_rating)::numeric(4,2), count(*) from gossoko.reviews
     where deleted_at is null and moderation_status = 'approved' group by venue_id`).map(([v, a, c]) => [v, { avg: Number(a), n: Number(c) }]));
  let worst = 0, staleCount = 0, zeroWithReviews = 0;
  for (const v of shown) {
    const t = truth.get(v.id);
    if (!t) continue;
    const gap = Math.abs(v.overall - t.avg);
    worst = Math.max(worst, gap);
    if (v.review_count !== t.n) staleCount++;
    if (v.overall === 0 && t.n > 0) zeroWithReviews++;
  }
  const totalRows = Number(sql(`select count(*) from gossoko.reviews where deleted_at is null`));
  const hidden = Number(sql(`select count(*) from gossoko.reviews where deleted_at is null and moderation_status <> 'approved'`));
  const pendingVenues = Number(sql(`select count(*) from gossoko.venues where moderation_status = 'pending' and deleted_at is null`));
  const spamLive = Number(sql(`select count(*) from gossoko.reviews where deleted_at is null and moderation_status = 'approved'
     and (body ilike '%bootdeals%' or body ilike '%crypto%' or body ilike '%0400 000 000%' or body ilike '%link in bio%')`));
  const abuseLive = Number(sql(`select count(*) from gossoko.comments where deleted_at is null and moderation_status = 'approved'
     and (body ilike '%slur%' or body ilike '%idiots%' or body ilike '%grub%' or body ilike '%bootdeals%' or body ilike '%crypto%')`));
  const helpfulDrift = Number(sql(`select count(*) from gossoko.reviews r where helpful_count <> (select count(*) from gossoko.review_likes l where l.review_id = r.id)`));
  const profileDrift = Number(sql(`select count(*) from gossoko.profiles p where coalesce(reviews_count,0) <> (select count(*) from gossoko.reviews r where r.user_id = p.id and r.deleted_at is null and r.moderation_status = 'approved')`));
  metrics.daily.push({ day: dayLabel(day), users: people.length, venuesShown: shown.length, reviews: totalRows, hiddenReviews: hidden, pendingVenues,
    worstScoreGap: +worst.toFixed(2), venuesWithWrongCount: staleCount, venuesShowing0WithReviews: zeroWithReviews, spamLive, abuseLive, helpfulDrift, profileDrift });

  if (worst > 0.5) issue('venue score on cards/rankings differs from its reviews by > 0.5 star', `worst gap ${worst.toFixed(2)}`, day);
  if (zeroWithReviews) issue('new venue has approved reviews but shows 0.0 overall', `${zeroWithReviews} venues`, day);
  if (staleCount) issue('review count on venue card is wrong', `${staleCount} venues`, day);
  if (helpfulDrift) issue('helpful count out of sync with likes', `${helpfulDrift} reviews`, day);
  if (profileDrift) issue('profile review count is wrong', `${profileDrift} profiles`, day);
  if (spamLive > 3) issue('spam reviews live for more than a day', `${spamLive} live`, day);
  if (abuseLive > 3) issue('abusive/spam comments live', `${abuseLive} live`, day);
  // Per-axis bars: do they match approved reviews only?
  const axisTruth = new Map(sqlRows(`select venue_id, avg(coffee_strength_rating)::numeric(4,2), avg(speed_rating)::numeric(4,2) from gossoko.reviews
     where deleted_at is null and moderation_status = 'approved' group by venue_id`).map(([v, c, s]) => [v, [Number(c), Number(s)]]));
  let axisOff = 0;
  for (const v of shown) {
    const t = axisTruth.get(v.id);
    if (!t) continue;
    if (Math.abs(v.ratings.coffee_strength - t[0]) > 0.5 || Math.abs(v.ratings.speed - t[1]) > 0.5) axisOff++;
  }
  if (axisOff) issue('rating bars differ from approved reviews by > 0.5 (hidden reviews counted, or rows cut off)', `${axisOff} venues`, day);
  if (totalRows > 1000 && day % 7 === 0) {
    const { data } = await app.client.supabase().from('reviews').select('id').is('deleted_at', null);
    if ((data?.length ?? 0) < totalRows - hidden) metrics.apiRowCapSeen = `${data?.length} of ${totalRows - hidden} visible reviews returned in one unpaged request`;
  }
  // Badges
  const unearnedVerified = Number(sql(`select count(*) from gossoko.venues v where is_verified and not exists (select 1 from gossoko.venue_claims c where c.venue_id = v.id and c.status = 'approved')`));
  if (unearnedVerified) issue('venues show a Verified badge without an approved owner claim', `${unearnedVerified} venues`, day);
  const simNow = new Date(START.getTime() + (day + 1) * 864e5).toISOString();
  const wrongTrending = Number(sql(`select count(*) from gossoko.venues v where coalesce(trending_until > '${simNow}', false) <> (
     (select count(*) from gossoko.reviews r where r.venue_id = v.id and r.moderation_status='approved' and r.deleted_at is null
        and r.created_at > '${simNow}'::timestamptz - interval '14 days' and r.created_at <= '${simNow}') >= 3)`));
  if (wrongTrending) issue('Trending badge wrong (3+ reviews in the last 14 days)', `${wrongTrending} venues`, day);
}

// ── the run ────────────────────────────────────────────────────────────────
test('Gossoko — six months of operation', async () => {
  app = await loadApp();
  runStart = sql(`select now()`);
  const timingByMonth: Record<string, number[]> = {};

  // Day 0: the owner (admin) and the seed venues.
  const admin = (await join('admin', 0))!;
  sql(`update gossoko.profiles set role = 'admin' where id = '${admin.id}'`);
  for (const [id, rating] of sqlRows(`select id, rating from gossoko.venues`)) venueTruth.set(id, Math.max(2, Number(rating) - (rnd() * 1.2)));

  let premod = false;
  for (let day = 0; day < DAYS; day++) {
    const month = dayLabel(day).slice(0, 7);
    const timing = (timingByMonth[month] ??= []);

    // Launch → word of mouth: ~0.4/day at first, ~6/day by month five.
    const target = Math.round(650 / (1 + Math.exp(-(day - 105) / 24)));
    const realUsers = people.filter((p) => !['admin', 'moderator'].includes(p.kind)).length;
    for (let i = realUsers; i < target; i++) {
      const r = rnd();
      await join(r < 0.66 ? 'tradie' : r < 0.9 ? 'lurker' : r < 0.94 ? 'owner' : 'spammer', day);
    }
    if (day === 45) {
      const m = await join('moderator', day);
      if (m) sql(`update gossoko.profiles set role = 'moderator' where id = '${m.id}'`);
    }
    // Owners claim their place once they hear about the app.
    for (const o of people.filter((p) => p.kind === 'owner' && p.joined === day)) {
      await as(o);
      const target = pick(sqlRows(`select id from gossoko.venues where moderation_status='approved' and deleted_at is null`))[0];
      const out = await app.claim(target);
      if (out === 'error') issue('venue claim failed', target, day);
      if (out === 'taken') metrics.claimsBlockedAsTaken = (metrics.claimsBlockedAsTaken ?? 0) + 1;
      metrics.claims = (metrics.claims ?? 0) + (out === 'submitted' ? 1 : 0);
    }

    // Plan says: turn pre-moderation on once real sign-ups start. Do it at month 4.
    if (!premod && day === 120) {
      vi.stubEnv('VITE_GOSSOKO_REVIEW_PREMODERATION', 'true');
      // After migration 20261105000002 the database setting is what counts.
      if (sql(`select to_regclass('gossoko.app_settings') is not null`) === 't') {
        sql(`update gossoko.app_settings set value = 'true' where key = 'review_premoderation'`);
      }
      vi.resetModules();
      app = await loadApp();
      premod = true;
    }

    // Weekdays are busy, weekends quiet.
    const dow = new Date(START.getTime() + day * 864e5).getDay();
    const busy = dow === 0 ? 0.25 : dow === 6 ? 0.5 : 1;
    for (const p of people) {
      if (p.kind === 'admin' || p.kind === 'moderator' || !p.hasProfile) continue;
      const fade = Math.exp(-(day - p.joined) / 120); // people drift off
      if (chance(p.activity * busy * (0.35 + 0.65 * fade))) {
        try { await visit(p, day, timing); }
        catch (e) { issue(`crash during a visit: ${(e as Error).message}`, p.username, day); }
      }
    }
    // Moderators check in every 2–4 days (it's a side job).
    if (day % 3 === 2 || chance(0.15)) {
      const mods = people.filter((p) => p.kind === 'admin' || p.kind === 'moderator');
      await moderate(pick(mods), day);
    }

    backdate(day);
    await checks(day);
    if (day % 30 === 0) origErr(`[sim] ${dayLabel(day)} users=${people.length} reviews=${sql('select count(*) from gossoko.reviews')}`);
  }

  // ── Abuse probes: what a spammer can do straight through the public API
  // (anyone can call it with the anon key in the app bundle). ──
  const last = DAYS - 1;
  const troll = people.find((p) => p.kind === 'spammer' && p.hasProfile);
  if (troll) {
    await as(troll);
    const sb = app.client.supabase();
    const anyVenue = sql(`select id from gossoko.venues where moderation_status='approved' and deleted_at is null order by name limit 1`);

    // 1. Post a review straight as 'approved' while pre-moderation is on.
    const { data: own } = await sb.from('reviews').upsert({ venue_id: anyVenue, user_id: troll.id, title: 'Great', body: 'Visit bootdeals.example for 80% off', moderation_status: 'approved', ...stars(() => 5) }, { onConflict: 'venue_id,user_id' }).select('id, moderation_status').maybeSingle();
    if (own?.moderation_status === 'approved') issue('ABUSE: user can publish a review as approved, skipping pre-moderation', troll.username, last);

    // 2. A moderator hides it; the author flips it back.
    const hiddenId = own?.id ?? sql(`select id from gossoko.reviews where user_id='${troll.id}' limit 1`);
    if (hiddenId) {
      sql(`update gossoko.reviews set moderation_status='rejected' where id='${hiddenId}'`);
      await sb.from('reviews').update({ moderation_status: 'approved' }).eq('id', hiddenId);
      if (sql(`select moderation_status from gossoko.reviews where id='${hiddenId}'`) === 'approved') issue('ABUSE: author can un-hide a review a moderator rejected', troll.username, last);
      // 3. …and pad its helpful count.
      await sb.from('reviews').update({ helpful_count: 999 }).eq('id', hiddenId);
      if (sql(`select helpful_count from gossoko.reviews where id='${hiddenId}'`) === '999') issue('ABUSE: author can set their own helpful count', troll.username, last);
    }

    // 4. Add a venue already approved, verified, trending and 5-star.
    const slug = `boot-deals-${Date.now()}`;
    await sb.from('venues').insert({ name: 'Boot Deals', suburb: 'Rocklea', state: 'QLD', address: '1 Spam St', type: 'cafe', latitude: -27.54, longitude: 152.99,
      slug, created_by: troll.id, moderation_status: 'approved', is_verified: true, trending: true, rating: 5, review_count: 999 });
    const v = sqlRows(`select moderation_status, is_verified, trending, rating, review_count from gossoko.venues where slug='${slug}'`)[0];
    if (v?.[0] === 'approved') issue('ABUSE: user can add a venue as already approved', troll.username, last);
    if (v?.[1] === 't' || v?.[2] === 't' || Number(v?.[3]) === 5 || v?.[4] === '999') issue('ABUSE: user can mark their venue verified/trending or set its rating/review count', `${v}`, last);

    // 5. Make themselves a moderator / admin.
    await sb.from('profiles').update({ role: 'admin' }).eq('id', troll.id);
    if (sql(`select role from gossoko.profiles where id='${troll.id}'`) === 'admin') issue('ABUSE: user can make themselves admin', troll.username, last);

    // 6. Suspended: can they keep posting?
    sql(`insert into gossoko.user_suspensions (user_id, reason, suspended_by, suspended_until)
         values ('${troll.id}', 'spam', '${admin.id}', now() + interval '30 days')`);
    const target = sql(`select id from gossoko.reviews where moderation_status='approved' and deleted_at is null and user_id <> '${troll.id}' limit 1`);
    const before = Number(sql(`select count(*) from gossoko.comments where user_id='${troll.id}'`));
    await sb.from('comments').insert({ review_id: target, user_id: troll.id, body: 'still here lol', moderation_status: 'approved' });
    if (Number(sql(`select count(*) from gossoko.comments where user_id='${troll.id}'`)) > before) issue('suspended user can still comment', troll.username, last);

    // 7. Flood: 40 comments in a row.
    const n0 = Number(sql(`select count(*) from gossoko.comments`));
    const victim = people.find((p) => p.kind === 'spammer' && p.hasProfile && p.id !== troll.id) ?? troll;
    await as(victim);
    for (let i = 0; i < 40; i++) await app.client.supabase().from('comments').insert({ review_id: target, user_id: victim.id, body: `flood ${i}`, moderation_status: 'approved' });
    const flooded = Number(sql(`select count(*) from gossoko.comments`)) - n0;
    if (flooded >= 40) issue('no posting rate limit: 40 comments in a few seconds all accepted', victim.username, last);
  }

  // Claimed venue: can the new owner edit it, and has the original adder lost access?
  const claimed = sqlRows(`select c.venue_id, c.user_id from gossoko.venue_claims c where c.status='approved' limit 1`)[0];
  if (claimed) {
    const owner = people.find((p) => p.id === claimed[1]);
    if (owner) {
      await as(owner);
      const { error, data } = await app.client.supabase().from('venues').update({ tagline: 'Now owner-managed' }).eq('id', claimed[0]).select('id');
      if (error || !data?.length) issue('approved owner cannot update their venue', error?.message ?? 'no rows', DAYS - 1);
    }
  }

  const finalTotals = Object.fromEntries(['profiles', 'venues', 'reviews', 'comments', 'review_likes', 'content_reports', 'venue_claims', 'moderation_queue', 'audit_logs']
    .map((t) => [t, Number(sql(`select count(*) from gossoko.${t}`))]));
  const latency = Object.fromEntries(Object.entries(timingByMonth).map(([m, a]) => {
    const s = [...a].sort((x, y) => x - y);
    return [m, { visits: a.length, p50ms: Math.round(s[Math.floor(s.length / 2)] ?? 0), p95ms: Math.round(s[Math.floor(s.length * 0.95)] ?? 0) }];
  }));
  const errorKinds: Record<string, number> = {};
  for (const e of appErrors) { const k = e.replace(/[0-9a-f-]{36}/g, '<id>').slice(0, 140); errorKinds[k] = (errorKinds[k] ?? 0) + 1; }
  const report = {
    simulated: `${dayLabel(0)} → ${dayLabel(DAYS - 1)}`,
    people: people.reduce<Record<string, number>>((a, p) => ((a[p.kind] = (a[p.kind] ?? 0) + 1), a), {}),
    totals: finalTotals,
    activity: { ...metrics, venueWaitDays: undefined, daily: undefined,
      // From the audit log: both timestamps are on the simulated calendar.
      avgVenueWaitDays: Number(sql(`select round(avg(extract(epoch from a.created_at - v.created_at) / 86400)::numeric, 1)
        from gossoko.audit_logs a join gossoko.venues v on v.id::text = a.resource_id::text where a.action_type like 'venue.%'`)) },
    feedLatency: latency,
    issues: Object.fromEntries([...issues].sort((a, b) => b[1].count - a[1].count)),
    appErrors: errorKinds,
    lastDay: metrics.daily.at(-1),
    monthly: metrics.daily.filter((_: any, i: number) => i % 30 === 29),
  };
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  origErr(`[sim] done → ${OUT}`);
});
