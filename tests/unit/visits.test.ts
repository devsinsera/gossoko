import { describe, it, expect } from 'vitest';
import {
  RULES, DEFAULT_SETTINGS, allowedMetres, venueHere, nearestVenues, inQuietHours, onEnter, onExit, arrivalText,
  type VisitSettings,
} from '@/lib/visits/policy';

// Eve Cafe, Greenbank-ish. 0.0009° latitude ≈ 100 m.
const EVE = { id: 'eve', name: 'Eve', lat: -27.7000, lng: 153.0000 };
const SERVO = { id: 'servo', name: 'Servo', lat: -27.7020, lng: 153.0000 }; // ~222 m south
const ON: VisitSettings = { ...DEFAULT_SETTINGS, enabled: true };
const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m);

describe('where you are', () => {
  it('allows 75 m plus the fix accuracy, capped at +75 m (same rule as the server)', () => {
    expect(allowedMetres()).toBe(75);
    expect(allowedMetres(30)).toBe(105);
    expect(allowedMetres(500)).toBe(150);
    expect(allowedMetres(-4)).toBe(75);
  });
  it('finds the venue you are standing at, and only within range', () => {
    expect(venueHere([EVE, SERVO], { lat: -27.7003, lng: 153 })?.id).toBe('eve');      // ~33 m
    expect(venueHere([EVE, SERVO], { lat: -27.7010, lng: 153 }, 5)).toBeNull();         // ~111 m, sharp fix
    expect(venueHere([EVE, SERVO], { lat: -27.7010, lng: 153 }, 60)?.id).toBe('eve');  // fuzzy fix allows 135 m
  });
  it('picks the closest when two are in range', () => {
    const next = { ...SERVO, id: 'next', lat: -27.7004 };
    expect(venueHere([EVE, next], { lat: -27.70035, lng: 153 })?.id).toBe('next');
  });
  it('watches the nearest n', () => {
    const far = { ...EVE, id: 'far', lat: -26.5 };
    expect(nearestVenues([far, SERVO, EVE], { lat: -27.7, lng: 153 }, 2).map((v) => v.id)).toEqual(['eve', 'servo']);
  });
});

describe('quiet hours', () => {
  it('handles a window across midnight', () => {
    expect(inQuietHours(at(21), '20:00', '05:00')).toBe(true);
    expect(inQuietHours(at(4, 59), '20:00', '05:00')).toBe(true);
    expect(inQuietHours(at(5), '20:00', '05:00')).toBe(false);
    expect(inQuietHours(at(12), '20:00', '05:00')).toBe(false);
  });
  it('handles a same-day window and ignores nonsense', () => {
    expect(inQuietHours(at(13), '12:00', '14:00')).toBe(true);
    expect(inQuietHours(at(13), 'x', '14:00')).toBe(false);
    expect(inQuietHours(at(13), '09:00', '09:00')).toBe(false);
  });
});

describe('arriving', () => {
  const fresh = { reviewedRecently: false };
  it('queues the arrival alert after the dwell and the review prompt after 20 min', () => {
    expect(onEnter(at(7), ON, {}, fresh)).toEqual({ arrivalInMs: RULES.arrivalDwellS * 1000, reviewInMs: RULES.reviewDwellS * 1000 });
  });
  it('does nothing while the switch is off or the place is muted', () => {
    expect(onEnter(at(7), DEFAULT_SETTINGS, {}, fresh)).toEqual({ arrivalInMs: null, reviewInMs: null });
    expect(onEnter(at(7), ON, { muted: true }, fresh)).toEqual({ arrivalInMs: null, reviewInMs: null });
  });
  it('only one arrival alert per venue a day', () => {
    const now = at(7);
    expect(onEnter(now, ON, { lastArrivalAlert: now.getTime() - 3600_000 }, fresh).arrivalInMs).toBeNull();
    expect(onEnter(now, ON, { lastArrivalAlert: now.getTime() - 21 * 3600_000 }, fresh).arrivalInMs).not.toBeNull();
  });
  it('no review prompt after a recent review, inside a week of the last prompt, or with prompts off', () => {
    const now = at(7);
    expect(onEnter(now, ON, {}, { reviewedRecently: true }).reviewInMs).toBeNull();
    expect(onEnter(now, ON, { lastReviewPrompt: now.getTime() - 2 * 86400_000 }, fresh).reviewInMs).toBeNull();
    expect(onEnter(now, { ...ON, prompts: false }, {}, fresh).reviewInMs).toBeNull();
    expect(onEnter(now, { ...ON, arrival: false }, {}, fresh)).toEqual({ arrivalInMs: null, reviewInMs: RULES.reviewDwellS * 1000 });
  });
  it('stays quiet in quiet hours (judged at the time the alert would fire)', () => {
    expect(onEnter(at(19, 59), ON, {}, fresh).arrivalInMs).toBeNull(); // fires 20:01
    expect(onEnter(at(4, 50), ON, {}, fresh).arrivalInMs).toBeNull(); // fires 4:52
    expect(onEnter(at(4, 50), ON, {}, fresh).reviewInMs).not.toBeNull(); // fires 5:10
  });
});

describe('leaving', () => {
  const fresh = { reviewedRecently: false };
  it('a drive-past is not a visit and prompts nothing', () => {
    expect(onExit(at(7), at(7, 1), ON, {}, fresh, false)).toEqual({ cancelPending: true, reviewNow: false, visit: false });
  });
  it('a short stop counts as a visit, no prompt', () => {
    expect(onExit(at(7), at(7, 5), ON, {}, fresh, false)).toEqual({ cancelPending: true, reviewNow: false, visit: true });
  });
  it('leaving after 10+ min prompts now, unless the 20-min prompt already went', () => {
    expect(onExit(at(7), at(7, 12), ON, {}, fresh, false).reviewNow).toBe(true);
    expect(onExit(at(7), at(7, 40), ON, {}, fresh, true).reviewNow).toBe(false);
    expect(onExit(at(7), at(7, 12), ON, {}, { reviewedRecently: true }, false).reviewNow).toBe(false);
  });
});

describe('alert text', () => {
  it('reads the rating, count and signature', () => {
    expect(arrivalText({ name: 'Eve', overall: 4.62, review_count: 12, signature: 'bacon and egg rolls' }))
      .toEqual({ title: 'At Eve?', body: '★4.6 · 12 reviews · known for bacon and egg rolls. Tap to check in.' });
    expect(arrivalText({ name: 'New', overall: 0, review_count: 0 }).body).toBe('No reviews yet. Be the first. Tap to check in.');
  });
});
