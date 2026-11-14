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
const LAUNCH = Number(process.env.SIM_LAUNCH_USERS ?? 0);
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
    biz: await import('@/pages/_business/actions'),
    bq: await import('@/lib/queries/business'),
    adminApi: await import('@/lib/api/admin'),
  };
}

// ── the cast ────────────────────────────────────────────────────────────────
type Kind = 'tradie' | 'lurker' | 'owner' | 'spammer' | 'admin' | 'moderator';
interface Person { id: string; email: string; username: string; kind: Kind; token: string; joined: number; activity: number; hasProfile: boolean; deleted?: boolean; saved: Set<string>; }

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
// Business-layer ground truth, so the checks can compare the database with what SHOULD have happened.
const codes: { venue: string; code: string; userId: string }[] = [];          // issued, not yet redeemed
const dealEnds: { id: string; endDay: number }[] = [];                         // running deals and the sim day they lapse
const proUntil = new Map<string, number>();                                    // venue id → sim day Pro lapses
const promoEnds: { id: string; endDay: number }[] = [];
const ownerVenue = new Map<string, string>();                                  // owner person id → venue they run
const seen = { view: new Set<string>(), directions: new Set<string>(), share: new Set<string>() };  // distinct actor|venue|day
const dealErrors: Record<string, number> = {};
const bump = (k: string, n = 1) => { metrics[k] = (metrics[k] ?? 0) + n; };
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
  // Business tables: rows made today (real calendar) belong to the simulated day.
  stmts.push(`update gossoko.venue_analytics set date = '${base.slice(0, 10)}' where date = gossoko.brisbane_today()`);
  stmts.push(`update gossoko.event_dedupe set day = '${base.slice(0, 10)}' where day = gossoko.brisbane_today()`);
  stmts.push(`update gossoko.deal_codes set created_at = '${base}'::timestamptz + interval '6 hours' + random() * interval '10 hours' where created_at >= '${runStart}'`);
  stmts.push(`update gossoko.deal_codes set redeemed_at = created_at + interval '20 minutes' where redeemed_at >= '${runStart}'`);
  stmts.push(`update gossoko.review_replies set created_at = '${base}'::timestamptz + interval '8 hours' where created_at >= '${runStart}'`);
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
  const popular = [...venues].sort((a, b) => b.review_count - a.review_count).slice(0, 12);
  const v = chance(0.6) ? pick(popular) : pick(venues);
  const venue = await app.venues.getVenueBySlug(v.slug);
  if (!venue) { issue('venue in the list but its page 404s', v.slug, day); return; }
  const revs = await app.reviews.getReviewsByVenueId(venue.id);
  const threads = await app.comments.getCommentsByReviewIds(revs.map((r) => r.id));
  const liked = await app.reviews.getUserLikedReviewIds(p.id, revs.map((r) => r.id));

  // What the venue page does on open (and what a thumb does next).
  if (p.kind !== 'spammer') {
    await track(p, venue.id, 'view', day);
    if (chance(0.12)) await track(p, venue.id, 'directions', day);
    if (chance(0.03)) await track(p, venue.id, 'share', day);
  }

  if (p.kind === 'lurker') {
    if (chance(0.08)) await tradieBusiness(p, venue, day);
    return;
  }

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

  let mineDeleted = false;
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
    else { metrics.reviewDeletes = (metrics.reviewDeletes ?? 0) + 1; mineDeleted = true; }
  }

  // Double-tap a second review on the same venue (should be refused, cleanly).
  if (mine && !mineDeleted && chance(0.01)) {
    const res = await app.submitReview(form({ venue_id: venue.id, title: 'Again', body: 'Posting twice by accident', ...stars(() => 4) }));
    if (res.ok) issue('second review on the same venue was accepted', venue.slug, day);
  }

  if (p.kind === 'tradie' && chance(0.012)) await addVenue(p, day, false);

  await tradieBusiness(p, venue, day);
  if (p.kind === 'owner') await ownerBusiness(p, day);
  // Rarely, someone deletes their account.
  if (day > 20 && chance(p.kind === 'owner' ? 0.0008 : 0.0012)) await deleteAccount(p, day);
}

// ── business layer: what a tradie does with saves and deals ─────────────────
async function track(p: Person, venueId: string, kind: 'view' | 'directions' | 'share', day: number) {
  const key = `${p.id}|${venueId}|${day}`;
  seen[kind].add(key);
  const { error } = await app.client.supabase().rpc('track_venue_event', { p_venue: venueId, p_kind: kind, p_actor: 'dev-' + p.id });
  if (error) issue(`tracking call failed: ${error.message}`, kind, day);
}

async function tradieBusiness(p: Person, venue: { id: string; slug: string }, day: number) {
  // Save / unsave
  if (!p.saved.has(venue.id) && chance(0.07)) {
    const r = await app.biz.toggleSave(venue.id, false);
    if (r.ok) p.saved.add(venue.id); else issue(`save failed: ${r.error}`, venue.slug, day);
  } else if (p.saved.has(venue.id) && chance(0.03)) {
    const r = await app.biz.toggleSave(venue.id, true);
    if (r.ok) p.saved.delete(venue.id); else issue(`unsave failed: ${r.error}`, venue.slug, day);
  }
  // Deals: look at this venue's, maybe grab a code
  const deals = await app.bq.getLiveDeals(venue.id);
  if (deals.length && chance(0.3)) {
    const d = pick(deals);
    const r = await app.biz.claimDealCode(d.id);
    if (r.ok) {
      if (!codes.some((c) => c.code === r.code)) { codes.push({ venue: venue.id, code: r.code, userId: p.id }); bump('dealCodesIssued'); }
    } else { dealErrors[r.hint ?? r.error] = (dealErrors[r.hint ?? r.error] ?? 0) + 1; if (!['used_today', 'sold_out'].includes(r.hint ?? '')) issue(`claim deal failed: ${r.error}`, d.id, day); }
  }
  // The Deals tab and my codes
  if (chance(0.04)) {
    const all = await app.bq.getLiveDeals();
    const mine = await app.bq.getMyActiveCodes(p.id);
    if (all.length > 60) issue('deals list over its cap', `${all.length}`, day);
    void mine;
  }
  if (chance(0.02)) { const sv = await app.bq.getSavedVenueIds(p.id); if (sv.size !== p.saved.size) issue('saved spots list differs from what the user saved', `${sv.size} vs ${p.saved.size}`, day); }
}

// ── business layer: what a verified owner does ───────────────────────────────
async function ownerBusiness(p: Person, day: number) {
  if (!ownerVenue.has(p.id)) {
    const m = await app.bq.getManagedVenues(p.id);
    if (m[0]) ownerVenue.set(p.id, m[0].id);
  }
  const vid = ownerVenue.get(p.id);
  if (!vid) return;
  const pro = (proUntil.get(vid) ?? -1) > day;

  const stats = await app.bq.getVenueStats(vid, 30);
  if (!stats) issue('owner could not load their stats', vid, day);
  else {
    if (!pro && stats.directions !== null) issue('free venue can see Pro-only numbers', vid, day);
    if (pro && stats.directions === null) issue('Pro venue cannot see its Pro numbers', vid, day);
    if (!pro && stats.days > 7) issue('free venue got more than 7 days of history', `${stats.days}`, day);
  }

  // Redeem codes customers are holding for this venue
  for (const c of codes.filter((x) => x.venue === vid)) {
    if (!chance(0.85)) continue;
    const r = await app.biz.redeemDealCode(vid, c.code);
    if (r.ok) { bump('dealCodesRedeemed'); codes.splice(codes.indexOf(c), 1); }
    else { issue(`owner could not redeem a valid code: ${r.error}`, c.code, day); codes.splice(codes.indexOf(c), 1); }
  }
  // Codes nobody redeemed lapse after 2 hours — drop the ones the sim is done with.
  if (codes.length > 400) codes.splice(0, 200);

  // Post a deal now and then
  if (chance(0.14)) {
    const hours = pick([4, 24, 24 * 7]);
    const kind = pick(['percent', 'amount', 'other'] as const);
    const r = await app.biz.createDeal({ venueId: vid, title: pick(['Pie + coffee $8 before 7', 'Bacon & egg roll $6', 'Free cuppa with any brekkie', 'Tradie combo']),
      description: 'Show your code at the counter.', terms: 'One per customer', kind, value: kind === 'percent' ? 15 : 3, hours, maxRedemptions: chance(0.3) ? 25 : null });
    if (r.ok) {
      const id = sql(`select id from gossoko.venue_specials where venue_id = '${vid}' order by created_at desc limit 1`);
      dealEnds.push({ id, endDay: day + Math.max(1, Math.ceil(hours / 24)) });
      bump('dealsPosted');
    } else if (r.hint === 'deal_limit') bump(pro ? 'dealLimitHitPro' : 'dealLimitHitFree');
    else issue(`deal not posted: ${r.error}`, vid, day);
  }

  // Reply to a couple of reviews
  if (chance(0.35)) {
    const revs = await app.reviews.getReviewsByVenueId(vid, 15);
    const replies = await app.bq.getRepliesByReviewIds(revs.map((r) => r.id));
    for (const r of revs.filter((x) => !replies.has(x.id)).slice(0, 2)) {
      const out = await app.biz.postReply(r.id, pick(['Cheers for the feedback, see you again soon.', 'Sorry about the wait — we added a second machine.', 'Thanks mate, the boys will be stoked.']));
      if (out.ok) bump('ownerReplies'); else issue(`owner reply failed: ${out.error}`, r.id, day);
    }
  }
  // Ask for Pro
  if (!pro && chance(0.03)) {
    const r = await app.biz.requestPro(vid, 'Keen to see who is tapping Directions');
    if (r.ok) bump('proRequests'); else issue(`Pro request failed: ${r.error}`, vid, day);
  }
  // Tidy the listing sometimes
  if (chance(0.03)) {
    const r = await app.biz.saveVenueDetails(vid, { tagline: 'Strong coffee, early start', description: 'Family run since 2009.', phone: '07 3000 0000', opens_at: '04:30', closes_at: '14:00' });
    if (!r.ok) issue(`owner could not save listing: ${r.error}`, vid, day);
  }
}

async function deleteAccount(p: Person, day: number) {
  if (p.deleted || !p.hasProfile) return;
  await as(p);
  const r = await app.adminApi.deleteMyAccount();
  if (!r.ok) { issue(`account deletion failed: ${r.error}`, p.username, day); return; }
  p.deleted = true;
  bump('accountsDeleted');
  const left = sql(`select (select count(*) from gossoko.profiles where id = '${p.id}') + (select count(*) from gossoko.reviews where user_id = '${p.id}')
     + (select count(*) from gossoko.comments where user_id = '${p.id}') + (select count(*) from gossoko.favourites where user_id = '${p.id}')
     + (select count(*) from gossoko.deal_codes where user_id = '${p.id}') + (select count(*) from auth.users where id = '${p.id}')`);
  if (left !== '0') issue('deleted account left personal data behind', `${p.username}: ${left} rows`, day);
  const owned = ownerVenue.get(p.id);
  if (owned) { ownerVenue.delete(p.id); proUntil.delete(owned); }
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
  // Pro requests: grant most, dismiss a few.
  for (const [id, venue] of sqlRows(`select id, venue_id from gossoko.pro_requests where status = 'open'`)) {
    if (chance(0.7)) {
      const r = await app.biz.grantPro(venue, 90, 'sim grant');
      if (r.ok) { proUntil.set(venue, Math.max(proUntil.get(venue) ?? day, day) + 90); bump('proGranted'); } else issue(`grant Pro failed: ${r.error}`, venue, day);
    } else {
      const { error } = await app.client.supabase().from('pro_requests').update({ status: 'dismissed' }).eq('id', id);
      if (error) issue(`dismiss Pro request failed: ${error.message}`, id, day);
    }
  }
  // Sell a promoted slot now and then.
  if (chance(0.08)) {
    const rows = sqlRows(`select id from gossoko.venues where moderation_status = 'approved' and deleted_at is null`);
    if (rows.length) {
      const vid = pick(rows)[0];
      const r = await app.biz.featureVenue(vid, 'bronze', 7);
      if (r.ok) {
        const id = sql(`select id from gossoko.featured_venues where venue_id = '${vid}' and deleted_at is null`);
        const prev = promoEnds.find((x) => x.id === id);
        if (prev) prev.endDay = Math.max(prev.endDay, day) + 7; else promoEnds.push({ id, endDay: day + 7 });
        bump('promosSold');
      }
      else issue(`promotion failed: ${r.error}`, 'feature_venue', day);
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
  const p: Person = { id, email, username, kind, token: jwt(id, email), joined: day, activity: 0.15 + rnd() * 0.5, hasProfile, saved: new Set() };
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
  // Business layer
  const viewsDb = Number(sql(`select coalesce(sum(profile_views), 0) from gossoko.venue_analytics`));
  const dirDb = Number(sql(`select coalesce(sum(directions_taps), 0) from gossoko.venue_analytics`));
  const shareDb = Number(sql(`select coalesce(sum(shares), 0) from gossoko.venue_analytics`));
  if (viewsDb !== seen.view.size) issue('venue view counts differ from distinct people per day', `db ${viewsDb} vs ${seen.view.size}`, day);
  if (dirDb !== seen.directions.size) issue('Directions counts differ from distinct people per day', `db ${dirDb} vs ${seen.directions.size}`, day);
  if (shareDb !== seen.share.size) issue('share counts differ from distinct people per day', `db ${shareDb} vs ${seen.share.size}`, day);
  const saveDrift = Number(sql(`select count(*) from gossoko.venues v where save_count <> (select count(*) from gossoko.favourites f where f.venue_id = v.id)`));
  if (saveDrift) issue('venue save count out of sync with saved spots', `${saveDrift} venues`, day);
  const dealUnder = Number(sql(`select count(*) from gossoko.venue_specials s where redeemed_count < (select count(*) from gossoko.deal_codes c where c.special_id = s.id and c.redeemed_at is not null)
     or claimed_count < (select count(*) from gossoko.deal_codes c where c.special_id = s.id)`));
  if (dealUnder) issue('deal counters lower than the codes actually issued/redeemed', `${dealUnder} deals`, day);
  const overRedeemed = Number(sql(`select count(*) from gossoko.venue_specials where max_redemptions is not null and redeemed_count > max_redemptions`));
  if (overRedeemed) issue('a limited deal was redeemed more times than its limit', `${overRedeemed} deals`, day);
  const dupRedeem = Number(sql(`select count(*) from (select special_id, user_id, (redeemed_at at time zone 'Australia/Brisbane')::date d, count(*) from gossoko.deal_codes where redeemed_at is not null group by 1,2,3 having count(*) > 1) x`));
  if (dupRedeem) issue('someone redeemed the same deal twice in one day', `${dupRedeem}`, day);
  const dealsNoOwner = Number(sql(`select count(*) from gossoko.venue_specials s where deleted_at is null and end_date > now()
     and not exists (select 1 from gossoko.venue_claims c where c.venue_id = s.venue_id and c.status = 'approved' and c.deleted_at is null)`));
  if (dealsNoOwner) issue('deals still running on a venue with no verified owner', `${dealsNoOwner}`, day);
  const proDb = new Set(sqlRows(`select id from gossoko.venues where pro_until > now()`).map((r) => r[0]));
  const proSim = new Set([...proUntil].filter(([, d]) => d > day).map(([v]) => v));
  const proOff = [...proSim].filter((v) => !proDb.has(v)).length + [...proDb].filter((v) => !proSim.has(v)).length;
  if (proOff) issue('Pro status differs from the grants/lapses that happened', `${proOff} venues`, day);
  const shownDeals = (await app.bq.getLiveDeals()).length;
  const dbDeals = Number(sql(`select count(*) from gossoko.venue_specials where deleted_at is null and start_date <= now() and end_date > now()`));
  if (shownDeals !== Math.min(60, dbDeals)) issue('Deals tab differs from the running deals in the database', `${shownDeals} vs ${dbDeals}`, day);
  // Badges
  const unearnedVerified = Number(sql(`select count(*) from gossoko.venues v where is_verified and not exists (select 1 from gossoko.venue_claims c where c.venue_id = v.id and c.status = 'approved')`));
  if (unearnedVerified) issue('venues show a Verified badge without an approved owner claim', `${unearnedVerified} venues`, day);
  const simNow = new Date(START.getTime() + (day + 1) * 864e5).toISOString();
  const wrongTrending = Number(sql(`select count(*) from gossoko.venues v where coalesce(trending_until > '${simNow}', false) <> (
     (select count(*) from gossoko.reviews r where r.venue_id = v.id and r.moderation_status='approved' and r.deleted_at is null
        and r.created_at > '${simNow}'::timestamptz - interval '14 days' and r.created_at <= '${simNow}') >= 3)`));
  if (wrongTrending) issue('Trending badge wrong (3+ reviews in the last 14 days)', `${wrongTrending} venues`, day);
}

// ── probes: what the new rules must refuse, and allow ────────────────────────
async function businessProbes(admin: Person, last: number) {
  const live = people.filter((p) => p.hasProfile && !p.deleted);
  const tradies = live.filter((p) => p.kind === 'tradie');
  const owners = live.filter((p) => p.kind === 'owner' && ownerVenue.has(p.id));
  if (tradies.length < 6 || owners.length < 2) { origErr('[sim] probes skipped: not enough people'); return; }
  const [T, T2, T3, T4] = tradies;
  const [O, O2] = owners;
  const V = ownerVenue.get(O.id)!, W = ownerVenue.get(O2.id)!;
  const want = (cond: boolean, msg: string, ex = '') => { if (!cond) issue(`PROBE: ${msg}`, ex || 'probe', last); else bump('probesPassed'); };
  const sbAs = async (p: Person) => { await as(p); return app.client.supabase(); };
  const mkDeal = (venueId: string, over: Partial<{ title: string; max: number | null; hours: number }> = {}) =>
    app.biz.createDeal({ venueId, title: over.title ?? 'Probe deal', description: '', terms: '', kind: 'other', value: 0, hours: over.hours ?? 24, maxRedemptions: over.max ?? null });
  const clearDeals = (venueId: string) => sql(`update gossoko.venue_specials set deleted_at = now() where venue_id = '${venueId}' and deleted_at is null`);
  const makePro = (venueId: string) => sql(`insert into gossoko.venue_plans (venue_id, status, current_period_end, source) values ('${venueId}', 'active', now() + interval '30 days', 'manual')
     on conflict (venue_id) do update set status = 'active', current_period_end = now() + interval '30 days'`);
  const noPro = (venueId: string) => sql(`update gossoko.venue_plans set status = 'cancelled', current_period_end = now() - interval '1 second' where venue_id = '${venueId}'`);
  const dealId = (venueId: string) => sql(`select id from gossoko.venue_specials where venue_id = '${venueId}' and deleted_at is null order by created_at desc limit 1`);

  // --- a non-owner cannot act for a venue
  await as(T);
  const fake = await mkDeal(V, { title: 'FREE MONEY for everyone' });
  want(!fake.ok, 'a non-owner posted a deal on someone else\'s venue', V);
  clearDeals(V);
  const sbT = await sbAs(T);
  const st = await sbT.rpc('venue_stats', { p_venue: V, p_days: 7 });
  want(!!st.error, 'a non-owner could read a venue\'s stats');
  const an = await sbT.from('venue_analytics').select('*').limit(5);
  want((an.data ?? []).length === 0, 'a tradie could read other venues\' analytics');
  const forge = await sbT.from('venue_analytics').insert({ venue_id: V, date: '2026-01-01', profile_views: 99999 });
  want(!!forge.error, 'a tradie could write fake analytics');
  const notif = await sbT.from('notifications').insert({ user_id: T2.id, type: 'x', title: 'Your account is locked, click here' });
  want(!!notif.error, 'a tradie could put a notification in someone else\'s inbox');
  const claimNow = await sbT.rpc('grant_venue_pro', { p_venue: V, p_days: 365, p_note: 'free' });
  want(!!claimNow.error, 'a tradie could grant themselves Pro');
  const promoNow = await sbT.rpc('feature_venue', { p_venue: V, p_tier: 'platinum', p_days: 30 });
  want(!!promoNow.error, 'a tradie could buy themselves a promoted slot');
  const pf = await sbT.from('profiles').update({ is_verified: true, reviews_count: 500, followers_count: 9999, bio: 'x'.repeat(400) }).eq('id', T.id).select('is_verified, reviews_count, followers_count, bio').single();
  want(!pf.error && pf.data?.is_verified === false && Number(pf.data?.reviews_count) < 500 && Number(pf.data?.followers_count) < 9999 && (pf.data?.bio ?? '').length <= 280, 'a tradie could edit their own badge, counts or write a huge bio', JSON.stringify(pf.data));
  const swapV = await (await sbAs(O)).from('venues').update({ pro_until: '2099-01-01', save_count: 9999, rating: 5 }).eq('id', V).select('pro_until, save_count, rating').maybeSingle();
  want(!swapV.data || (swapV.data.pro_until === null || new Date(swapV.data.pro_until).getFullYear() < 2090) && Number(swapV.data.save_count) < 9999 && Number(swapV.data.rating) < 5, 'an owner could give their venue Pro/saves/rating by editing it');

  // --- free vs Pro limits
  await as(O);
  noPro(V); clearDeals(V);
  const d1 = await mkDeal(V);
  const d2 = await mkDeal(V);
  want(d1.ok && !d2.ok && (d2.ok === false && d2.hint === 'deal_limit'), 'a free venue can run more than one deal at a time', `${JSON.stringify(d2)}`);
  makePro(V);
  let proOk = 0;
  for (let i = 0; i < 6; i++) if ((await mkDeal(V)).ok) proOk++;
  const seventh = await mkDeal(V);
  want(proOk === 5 && !seventh.ok, 'Pro limit is not exactly 6 live deals', `ok=${proOk} 7th=${seventh.ok}`);
  clearDeals(V); noPro(V);

  // --- code lifecycle
  const dealA = await mkDeal(V, { title: 'Probe: pie + coffee', max: 1, hours: 24 });
  want(dealA.ok, 'owner could not post a probe deal');
  const did = dealId(V);
  await as(T);
  const c1 = await app.biz.claimDealCode(did);
  const c1b = await app.biz.claimDealCode(did);
  want(c1.ok && c1b.ok && c1.code === c1b.code, 'asking for a code twice gave two different codes');
  await as(O2);
  const wrong = await app.biz.redeemDealCode(W, c1.ok ? c1.code : 'x');
  want(!wrong.ok, 'another venue\'s owner redeemed this venue\'s code');
  await as(T);
  const selfRedeem = await app.biz.redeemDealCode(V, c1.ok ? c1.code : 'x');
  want(!selfRedeem.ok, 'a customer redeemed their own code');
  await as(O);
  const ok1 = await app.biz.redeemDealCode(V, c1.ok ? c1.code.toLowerCase() : 'x');
  want(ok1.ok, 'owner could not redeem a valid code (lower-case typed)');
  const again = await app.biz.redeemDealCode(V, c1.ok ? c1.code : 'x');
  want(!again.ok && again.hint === 'already_used', 'a code could be redeemed twice');
  await as(T);
  const sameDay = await app.biz.claimDealCode(did);
  want(!sameDay.ok, 'someone claimed the same deal twice in a day');
  await as(T2);
  const soldOut = await app.biz.claimDealCode(did);
  want(!soldOut.ok && soldOut.hint === 'sold_out', 'a sold-out deal still handed out a code', JSON.stringify(soldOut));
  clearDeals(V);

  const dealB = await (async () => { await as(O); return mkDeal(V, { title: 'Probe: expiry' }); })();
  want(dealB.ok, 'owner could not post a second probe deal');
  const did2 = dealId(V);
  await as(T3);
  const c2 = await app.biz.claimDealCode(did2);
  if (c2.ok) {
    sql(`update gossoko.deal_codes set expires_at = now() - interval '1 minute' where code = '${c2.code}'`);
    await as(O);
    const late = await app.biz.redeemDealCode(V, c2.code);
    want(!late.ok && late.hint === 'expired', 'an expired code was accepted', JSON.stringify(late));
  }
  const gone = await (async () => { await as(O); clearDeals(V); await as(T4); return app.biz.claimDealCode(did2); })();
  want(!gone.ok, 'a code was handed out for a deal that had ended');
  const signedOut = await (async () => { await as(null); return app.biz.claimDealCode(did2); })();
  want(!signedOut.ok, 'a signed-out visitor got a deal code');

  // --- replies
  const rv = sqlRows(`select id from gossoko.reviews where venue_id = '${V}' and moderation_status = 'approved' and deleted_at is null limit 3`);
  if (rv.length) {
    sql(`update gossoko.review_replies set deleted_at = now() where review_id = '${rv[0][0]}'`);
    await as(T);
    const nr = await app.biz.postReply(rv[0][0], 'Great place, trust me');
    want(!nr.ok, 'a non-owner posted a reply as the venue');
    await as(O);
    const link = await app.biz.postReply(rv[0][0], 'Visit www.bootdeals.example for 80% off');
    want(!link.ok && link.hint === 'links', 'an owner reply with a link/spam was accepted', JSON.stringify(link));
    const good = await app.biz.postReply(rv[0][0], 'Cheers for the feedback.');
    const twice = await app.biz.postReply(rv[0][0], 'And another one.');
    want(good.ok && !twice.ok, 'owner reply rules: one reply per review');
    await as(O2);
    const wrongOwner = await app.biz.postReply(rv[Math.min(1, rv.length - 1)][0], 'Not my venue but I will reply');
    want(!wrongOwner.ok, 'another venue\'s owner replied to this venue\'s review');
  }

  // --- listing edits
  await as(T);
  const edit = await app.biz.saveVenueDetails(V, { tagline: 'HACKED', description: '', phone: '', opens_at: '', closes_at: '' });
  want(!edit.ok, 'a non-owner edited a venue listing');

  // --- the community hides content three established people report
  const victim = sqlRows(`select c.id, c.user_id from gossoko.comments c where c.moderation_status = 'approved' and c.deleted_at is null limit 1`)[0];
  if (victim) {
    const reporters = tradies.filter((p) => p.id !== victim[1]).slice(4, 7);
    for (const rp of reporters) { await as(rp); await app.report({ reportableType: 'comment', reportableId: victim[0], reportType: 'spam', reason: 'probe: spam comment' }); }
    want(sql(`select moderation_status from gossoko.comments where id = '${victim[0]}'`) === 'flagged', 'three reports from established accounts did not hide the comment');
  }
  // --- spam words are held for a moderator
  const fresh = sqlRows(`select v.id from gossoko.venues v where moderation_status = 'approved' and deleted_at is null and not exists (select 1 from gossoko.reviews r where r.venue_id = v.id and r.user_id = '${T2.id}') limit 1`)[0];
  if (fresh) {
    await as(T2);
    const sp = await app.submitReview(form({ venue_id: fresh[0], title: 'Check this out', body: 'Best crypto tips, DM me on telegram', ...stars(() => 5) }));
    want(sp.ok && sp.pending, 'a spammy review went live straight away', JSON.stringify(sp));
    const ok = await (async () => { sql(`delete from gossoko.reviews where user_id = '${T2.id}' and venue_id = '${fresh[0]}'`); return app.submitReview(form({ venue_id: fresh[0], title: 'Good feed', body: 'Pie was hot and the coffee strong, fair price.', ...stars(() => 4) })); })();
    const premodOn = sql(`select value::text from gossoko.app_settings where key = 'review_premoderation'`) === 'true';
    want(ok.ok && (premodOn || !ok.pending), 'an ordinary review was held for moderation while pre-moderation was off');
  }
  // --- username checks
  await as(null);
  const dupe = await app.auth.signupUser('probe-dupe@example.test', 'Tradie2026!sim', T.username.toUpperCase());
  want(!dupe.success, 'a username differing only by case was accepted', JSON.stringify(dupe));
  void admin;
}

// ── the run ────────────────────────────────────────────────────────────────
test('Gossoko — six months of operation', async () => {
  app = await loadApp();
  runStart = sql(`select now()`);
  const timingByMonth: Record<string, number[]> = {};

  // Day 0: the owner (admin) and the seed venues.
  const admin = (await join('admin', 0))!;
  sql(`update gossoko.profiles set role = 'admin' where id = '${admin.id}'`);
  for (const [id] of sqlRows(`select id from gossoko.venues`)) venueTruth.set(id, 3 + rnd() * 1.8);

  let premod = false;
  for (let day = 0; day < DAYS; day++) {
    const month = dayLabel(day).slice(0, 7);
    const timing = (timingByMonth[month] ??= []);

    // Deals, Pro plans and promotions lapse on their simulated day.
    for (const d of dealEnds.filter((x) => x.endDay <= day)) sql(`update gossoko.venue_specials set end_date = now() - interval '1 second' where id = '${d.id}'`);
    for (let i = dealEnds.length - 1; i >= 0; i--) if (dealEnds[i].endDay <= day) dealEnds.splice(i, 1);
    for (const [vid, exp] of [...proUntil]) if (exp <= day) { sql(`update gossoko.venue_plans set status = 'cancelled', current_period_end = now() - interval '1 second' where venue_id = '${vid}'`); proUntil.delete(vid); bump('proLapsed'); }
    for (const d of promoEnds.filter((x) => x.endDay <= day)) sql(`update gossoko.featured_venues set end_date = now() - interval '1 second' where id = '${d.id}'`);
    for (let i = promoEnds.length - 1; i >= 0; i--) if (promoEnds[i].endDay <= day) promoEnds.splice(i, 1);

    // Launch → word of mouth: ~0.4/day at first, ~6/day by month five.
    // SIM_LAUNCH_USERS=N: a launch week instead (founding venues + flyers): N people spread evenly over the run.
    const target = LAUNCH ? Math.round(LAUNCH * (day + 1) / DAYS) : Math.round(650 / (1 + Math.exp(-(day - 105) / 24)));
    const realUsers = people.filter((p) => !['admin', 'moderator'].includes(p.kind)).length;
    for (let i = realUsers; i < target; i++) {
      const r = rnd();
      await join(r < 0.66 ? 'tradie' : r < 0.9 ? 'lurker' : r < 0.94 ? 'owner' : 'spammer', day);
    }
    if (day === (LAUNCH ? 1 : 45)) {
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
      if (p.kind === 'admin' || p.kind === 'moderator' || !p.hasProfile || p.deleted) continue;
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

  await businessProbes(admin, DAYS - 1);

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
