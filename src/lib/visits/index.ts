// Check-ins, arrival alerts and visit prompts — the web side.
//  • checkInHere(): a fresh GPS fix → gossoko.check_in() (the server re-checks the distance).
//  • The phone apps carry a small native plugin, "GossokoVisits", that watches the nearest venues
//    (geofences) while the app is closed and posts the alerts itself. syncVisits() sends it the venues
//    + settings, and uploads the visits it saw as 'auto' check-ins. Without the plugin (the website,
//    or an app build from before it existed) only manual check-ins exist.
// Positions never leave the phone: only venue + time are saved.

import { registerPlugin } from '@capacitor/core';
import { supabase as getSupabase } from '@/lib/supabase/client';
import { getAllVenues } from '@/lib/queries/venues';
import { OPEN_EVENT } from '@/lib/push';
import { RULES, DEFAULT_SETTINGS, arrivalText, reviewText, nearestVenues, type VisitSettings, type Point } from './policy';

export { RULES, DEFAULT_SETTINGS, allowedMetres, venueHere, type VisitSettings } from './policy';

const SETTINGS_KEY = 'gossoko.visits';

export type LocationAccess = 'none' | 'denied' | 'whenInUse' | 'always';
export interface VisitsStatus { location: LocationAccess; notifications: 'granted' | 'denied' | 'prompt' }
interface NativeVisit { venueId: string; at: number; leftAt: number | null; lat: number; lng: number; accuracy: number }
interface NativeVenue {
  id: string; name: string; lat: number; lng: number;
  arrivalTitle: string; arrivalBody: string; reviewTitle: string; reviewBody: string;
  arrivalPath: string; reviewPath: string; reviewedRecently: boolean;
}
interface VisitsPlugin {
  status(): Promise<VisitsStatus>;
  requestWhenInUse(): Promise<VisitsStatus>;
  requestAlways(): Promise<VisitsStatus>;
  configure(o: { settings: VisitSettings; rules: typeof RULES; venues: NativeVenue[] }): Promise<{ watching: number }>;
  stop(): Promise<void>;
  takeVisits(): Promise<{ visits: NativeVisit[] }>;
  takeOpen(): Promise<{ path: string | null }>;
  mutedCount(): Promise<{ count: number }>;
  clearMuted(): Promise<void>;
  addListener(ev: 'open', fn: (e: { path: string }) => void): Promise<unknown>;
}
type CapacitorLike = { getPlatform?: () => string; isPluginAvailable?: (n: string) => boolean };

let plugin: VisitsPlugin | null | undefined;
/** The native plugin, or null on the web / older app builds. */
export function nativeVisits(): VisitsPlugin | null {
  if (plugin !== undefined) return plugin;
  const cap = (globalThis as { Capacitor?: CapacitorLike }).Capacitor;
  const p = cap?.getPlatform?.();
  plugin = (p === 'ios' || p === 'android') && cap?.isPluginAvailable?.('GossokoVisits')
    ? registerPlugin<VisitsPlugin>('GossokoVisits') : null;
  return plugin;
}

function store(): Storage | null { try { return localStorage; } catch { return null; } }

export function loadSettings(): VisitSettings {
  try {
    const raw = store()?.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<VisitSettings>) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s: VisitSettings): void {
  try { store()?.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

/** A fresh, sharp position (not the cached one the distance labels use). */
export function freshPosition(timeoutMs = 12000): Promise<Point & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('This device can\'t share its location.')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1
        ? 'Location is off for Gossoko. Turn it on in Settings to check in.'
        : 'Couldn\'t get a fix on where you are. Try again in a moment.')),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15000 },
    );
  });
}

export interface CheckInResult { id: string; at: string; new: boolean; visits: number }

/** Check in at a venue from where the phone is now. Throws a readable Error. */
export async function checkInHere(venue: { id: string; name: string; lat: number; lng: number }): Promise<CheckInResult> {
  const pos = await freshPosition();
  const { data, error } = await getSupabase().rpc('check_in', {
    p_venue: venue.id, p_lat: pos.lat, p_lng: pos.lng, p_accuracy: Math.round(pos.accuracy), p_source: 'manual',
  });
  if (error) throw new Error(error.message || 'Couldn\'t check in. Try again.');
  return data as CheckInResult;
}

/** How many check-ins you have at a venue (0 when signed out). */
export async function myVisitCount(userId: string, venueId: string): Promise<number> {
  const { count, error } = await getSupabase().from('check_ins').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('venue_id', venueId);
  return error ? 0 : count ?? 0;
}

/** Venue ids you've checked in at (for the profile's "Venues" count). */
export async function myCheckInVenueIds(userId: string): Promise<string[]> {
  const { data, error } = await getSupabase().from('check_ins').select('venue_id').eq('user_id', userId).limit(1000);
  return error || !data ? [] : [...new Set(data.map((r: { venue_id: string }) => r.venue_id))];
}

export async function clearMyCheckIns(): Promise<number> {
  const { data, error } = await getSupabase().rpc('delete_my_check_ins');
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

async function reviewedRecently(userId: string): Promise<Set<string>> {
  const since = new Date(Date.now() - RULES.reviewedSkipD * 86400_000).toISOString();
  const { data } = await getSupabase().from('reviews').select('venue_id').eq('user_id', userId).gte('created_at', since).limit(1000);
  return new Set((data ?? []).map((r: { venue_id: string }) => r.venue_id));
}

type QueuedVisit = { venueId: string; lat: number; lng: number; accuracy: number; at: number; leftAt?: number | null };
const PENDING_KEY = (userId: string) => `gossoko.visits.pending.${userId}`;
function readPending(userId: string): QueuedVisit[] {
  try { const v = JSON.parse(localStorage.getItem(PENDING_KEY(userId)) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function writePending(userId: string, list: QueuedVisit[]): void {
  try {
    if (list.length) localStorage.setItem(PENDING_KEY(userId), JSON.stringify(list.slice(-200)));
    else localStorage.removeItem(PENDING_KEY(userId));
  } catch { /* storage unavailable: nothing kept */ }
}
/** No answer from the server at all (no signal), as opposed to the server refusing the visit. */
export function noAnswer(error: { code?: string; message?: string } | null): boolean {
  return !!error && !error.code && /fetch|network|load failed|timed? ?out/i.test(error.message ?? '');
}

/**
 * Upload the visits the phone saw while Gossoko was closed. The phone hands its queue over once (and
 * empties it), so the visits are kept here, per account, until the server has answered for each: one
 * that fails the server's checks is dropped; one that got no answer (no signal) waits for next time.
 */
async function uploadVisits(p: VisitsPlugin, userId: string): Promise<number> {
  const { visits } = await p.takeVisits();
  let waiting: QueuedVisit[] = [...readPending(userId), ...(visits as QueuedVisit[])];
  writePending(userId, waiting);
  let saved = 0;
  for (const v of [...waiting]) {
    let error: { code?: string; message?: string } | null = null;
    try {
      ({ error } = await getSupabase().rpc('check_in', {
        p_venue: v.venueId, p_lat: v.lat, p_lng: v.lng, p_accuracy: Math.round(v.accuracy), p_source: 'auto',
        p_at: new Date(v.at).toISOString(), p_left_at: v.leftAt ? new Date(v.leftAt).toISOString() : null,
      }));
    } catch (e) { error = { message: e instanceof Error ? e.message : 'network' }; }
    if (noAnswer(error)) break;   // no signal: keep this one and the rest
    if (!error) saved++;
    waiting = waiting.filter((x) => x !== v);
    writePending(userId, waiting);
  }
  return saved;
}

let syncing: Promise<void> | null = null;
let listening = false;

/**
 * After sign-in and whenever the app comes back to the front: upload visits, then send the phone the
 * venues to watch (or stop watching when the switch is off). Never throws.
 */
export function syncVisits(userId: string | null): Promise<void> {
  const p = nativeVisits();
  if (!p) return Promise.resolve();
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      if (!listening) {
        listening = true;
        await p.addListener('open', ({ path }) => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: path })));
        const { path } = await p.takeOpen();   // tapped an alert while Gossoko was closed
        if (path) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: path }));
      }
      const s = loadSettings();
      if (!userId || !s.enabled) { await p.stop(); return; }
      await uploadVisits(p, userId);
      const [venues, reviewed] = await Promise.all([getAllVenues(), reviewedRecently(userId)]);
      // Send the nearest 200 to where the phone is now (or all, if there's no fix); it re-picks as you move.
      let pool = venues;
      if (venues.length > RULES.maxVenuesSent) {
        const here = await freshPosition(6000).catch(() => null);
        pool = here ? nearestVenues(venues, here, RULES.maxVenuesSent) : venues.slice(0, RULES.maxVenuesSent);
      }
      await p.configure({
        settings: s,
        rules: RULES,
        venues: pool.map((v) => {
          const a = arrivalText(v); const r = reviewText(v.name);
          return {
            id: v.id, name: v.name, lat: v.lat, lng: v.lng,
            arrivalTitle: a.title, arrivalBody: a.body, reviewTitle: r.title, reviewBody: r.body,
            arrivalPath: `/venue/${v.slug}?checkin=1`, reviewPath: `/review/new?venue=${encodeURIComponent(v.slug)}`,
            reviewedRecently: reviewed.has(v.id),
          };
        }),
      });
    } catch (e) {
      console.warn('[gossoko] visits sync failed:', e instanceof Error ? e.message : e);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/** Signing out: stop watching (the next person on the phone hasn't said yes). */
/**
 * Sign-out: stop watching, throw away visits the phone still holds (they were this person's — the next
 * account to sign in on this phone must not upload them as its own) and switch check-ins off, so the next
 * account opts in for itself.
 */
export async function stopVisits(): Promise<void> {
  const p = nativeVisits();
  try { await p?.stop(); } catch { /* old build */ }
  try { await p?.takeVisits(); } catch { /* old build */ }
  const s = loadSettings();
  if (s.enabled) saveSettings({ ...s, enabled: false });
}

