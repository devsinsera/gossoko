// Check-ins, arrival alerts and visit prompts: the rules, in one place.
// Pure (no DOM, no network) so vitest covers them. The phone apps run the same rules natively while the
// web app is closed (native/ios/App/App/VisitsPlugin.swift, native/android/.../VisitsPlugin.java); the
// numbers below are sent to them in configure(), so the thresholds can't drift apart.

import { haversineKm } from '@/lib/geo';

export const RULES = {
  /** You're "at" a venue within this many metres of its pin (plus the phone's accuracy, capped). */
  checkInRadiusM: 75,
  /** Extra allowance for a fuzzy GPS fix, at most this much. The server uses the same rule. */
  accuracyAllowanceM: 75,
  /** Geofence size. iOS region monitoring is unreliable below ~100 m. */
  regionRadiusM: 100,
  /** Stay this long before an arrival alert (drive-pasts and servo queues at the lights don't count). */
  arrivalDwellS: 120,
  /** Stay this long and a review prompt is sent while you're still there. */
  reviewDwellS: 20 * 60,
  /** Or leave after at least this long and the prompt comes as you go. */
  reviewOnLeaveMinS: 10 * 60,
  /** At most one arrival alert per venue in this many hours (≈ once a day). */
  arrivalGapH: 20,
  /** At most one review prompt per venue in this many days. */
  reviewGapD: 7,
  /** No review prompt when you reviewed the place in the last this-many days. */
  reviewedSkipD: 30,
  /** How many venues the phone watches at once (iOS allows 20 regions per app; Android 100). */
  maxRegionsIos: 20,
  maxRegionsAndroid: 100,
  /** Venues sent to the phone; it picks the nearest few itself as you move. */
  maxVenuesSent: 200,
} as const;

export interface VisitSettings {
  /** Background alerts on at all (the Settings switch). */
  enabled: boolean;
  /** "At <venue>?" alerts on arrival. */
  arrival: boolean;
  /** "How was <venue>?" prompts after a visit. */
  prompts: boolean;
  /** No alerts between these times (phone's clock, 24 h "HH:MM"). */
  quietFrom: string;
  quietTo: string;
}

export const DEFAULT_SETTINGS: VisitSettings = {
  enabled: false,
  arrival: true,
  prompts: true,
  quietFrom: '20:00',
  quietTo: '05:00',
};

export interface Point { lat: number; lng: number }

export function metresBetween(a: Point, b: Point): number {
  return haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000;
}

/** How close counts as "here" for a fix with this accuracy (metres). Matches gossoko.check_in(). */
export function allowedMetres(accuracyM?: number | null): number {
  const acc = Number.isFinite(accuracyM) && (accuracyM as number) > 0 ? (accuracyM as number) : 0;
  return RULES.checkInRadiusM + Math.min(acc, RULES.accuracyAllowanceM);
}

/** The venue you're at (closest pin within the allowed distance), or null. */
export function venueHere<V extends Point>(venues: V[], at: Point, accuracyM?: number | null): (V & { metres: number }) | null {
  const limit = allowedMetres(accuracyM);
  let best: (V & { metres: number }) | null = null;
  for (const v of venues) {
    if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) continue;
    const m = metresBetween(at, v);
    if (m <= limit && (!best || m < best.metres)) best = { ...v, metres: m };
  }
  return best;
}

/** The `n` venues nearest to `at` (what the phone watches). */
export function nearestVenues<V extends Point>(venues: V[], at: Point, n: number): V[] {
  return venues
    .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng))
    .map((v) => ({ v, m: metresBetween(at, v) }))
    .sort((a, b) => a.m - b.m)
    .slice(0, n)
    .map((x) => x.v);
}

function minutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]); const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

/** Is `when` (phone's local time) inside the quiet hours? Handles windows across midnight. */
export function inQuietHours(when: Date, from: string, to: string): boolean {
  const f = minutes(from); const t = minutes(to);
  if (f === null || t === null || f === t) return false;
  const now = when.getHours() * 60 + when.getMinutes();
  return f < t ? now >= f && now < t : now >= f || now < t;
}

/** What the phone remembers per venue. Times are ms since epoch. */
export interface VenueMemory {
  lastArrivalAlert?: number;
  lastReviewPrompt?: number;
  /** "Don't ask for this place". */
  muted?: boolean;
}

export interface VenueFacts {
  /** You reviewed it in the last RULES.reviewedSkipD days. */
  reviewedRecently: boolean;
}

/** On entering a venue's geofence: which alerts to queue (ms delays from now), if any. */
export function onEnter(
  now: Date, s: VisitSettings, mem: VenueMemory, facts: VenueFacts,
): { arrivalInMs: number | null; reviewInMs: number | null } {
  if (!s.enabled || mem.muted) return { arrivalInMs: null, reviewInMs: null };
  const arrivalAt = new Date(now.getTime() + RULES.arrivalDwellS * 1000);
  const reviewAt = new Date(now.getTime() + RULES.reviewDwellS * 1000);
  const arrival = s.arrival
    && !inQuietHours(arrivalAt, s.quietFrom, s.quietTo)
    && (mem.lastArrivalAlert == null || now.getTime() - mem.lastArrivalAlert >= RULES.arrivalGapH * 3600_000);
  return {
    arrivalInMs: arrival ? RULES.arrivalDwellS * 1000 : null,
    reviewInMs: reviewAllowed(reviewAt, s, mem, facts) ? RULES.reviewDwellS * 1000 : null,
  };
}

function reviewAllowed(at: Date, s: VisitSettings, mem: VenueMemory, facts: VenueFacts): boolean {
  return s.enabled && s.prompts && !mem.muted && !facts.reviewedRecently
    && !inQuietHours(at, s.quietFrom, s.quietTo)
    && (mem.lastReviewPrompt == null || at.getTime() - mem.lastReviewPrompt >= RULES.reviewGapD * 86400_000);
}

/**
 * On leaving: cancel what hasn't fired, maybe prompt now, and whether it counts as a visit.
 * `reviewSent` = the 20-minute prompt already went out during this stay.
 */
export function onExit(
  enteredAt: Date, now: Date, s: VisitSettings, mem: VenueMemory, facts: VenueFacts, reviewSent: boolean,
): { cancelPending: true; reviewNow: boolean; visit: boolean } {
  const stayedS = (now.getTime() - enteredAt.getTime()) / 1000;
  return {
    cancelPending: true,
    reviewNow: !reviewSent && stayedS >= RULES.reviewOnLeaveMinS && reviewAllowed(now, s, mem, facts),
    visit: stayedS >= RULES.arrivalDwellS,
  };
}

/** The arrival alert's text. */
export function arrivalText(v: { name: string; overall: number; review_count: number; signature?: string }): { title: string; body: string } {
  const bits: string[] = [];
  if (v.review_count > 0) bits.push(`★${v.overall.toFixed(1)} · ${v.review_count} ${v.review_count === 1 ? 'review' : 'reviews'}`);
  else bits.push('No reviews yet. Be the first');
  if (v.signature?.trim()) bits.push(`known for ${v.signature.trim()}`);
  return { title: `At ${v.name}?`, body: `${bits.join(' · ')}. Tap to check in.` };
}

export function reviewText(name: string): { title: string; body: string } {
  return { title: `How was ${name}?`, body: 'Leave a quick review. Tradies nearby will thank you.' };
}
