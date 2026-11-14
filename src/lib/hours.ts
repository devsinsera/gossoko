// Opening hours: one daily window, "HH:MM" (24h) opens/closes as owners type them.
// A 24-hour venue is stored as 00:00–23:59, 00:00–00:00 or 00:00–24:00 (or any window that opens and
// closes at the same minute). A window that closes earlier than it opens runs past midnight (18:00–02:00).

/** Minutes after midnight for "HH:MM" or "HH:MM:SS"; 24:00 → 1440. Null when it isn't a time. */
export function toMinutes(t: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((t ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min !== 0)) return null;
  return h * 60 + min;
}

/** True when the window covers the whole day. */
export function isOpen24h(opens: string | null | undefined, closes: string | null | undefined): boolean {
  const o = toMinutes(opens);
  const c = toMinutes(closes);
  if (o == null || c == null) return false;
  if (o === c) return true;                                  // 00:00–00:00, 05:00–05:00
  if (o === 0 && (c === 1439 || c === 1440)) return true;    // 00:00–23:59, 00:00–24:00
  return false;
}

/** Minutes after midnight in Brisbane (UTC+10 all year, no daylight saving) — venue hours are Queensland time,
 *  so a phone set to Sydney/Melbourne time in summer (an hour ahead) still reads them right. */
export function brisbaneMinutes(at: Date): number {
  return ((at.getUTCHours() + 10) % 24) * 60 + at.getUTCMinutes();
}

/** Open at this moment in Queensland time, including windows that cross midnight. */
export function isOpenAt(opens: string | null | undefined, closes: string | null | undefined, at: Date = new Date()): boolean {
  const o = toMinutes(opens);
  const c = toMinutes(closes);
  if (o == null || c == null) return false;
  if (isOpen24h(opens, closes)) return true;
  const now = brisbaneMinutes(at);
  return c > o ? now >= o && now < c : now >= o || now < c;
}

/** "HH:MM:SS" → "HH:MM"; anything else unchanged. */
function short(t: string): string {
  return /^\d{1,2}:\d{2}:\d{2}$/.test(t) ? t.slice(0, -3) : t;
}

/**
 * What a card or venue page shows for the hours.
 *   long:  "Open 24 hours" | "05:30–14:00" | "Opens 05:30" | ""
 *   short: "24h" | "05:30" (the opening time)
 */
export function hoursLabel(opens: string | null | undefined, closes: string | null | undefined, style: 'long' | 'short' = 'long'): string {
  if (isOpen24h(opens, closes)) return style === 'short' ? '24h' : 'Open 24 hours';
  const o = opens ? short(opens.trim()) : '';
  const c = closes ? short(closes.trim()) : '';
  if (style === 'short') return o;
  if (o && c) return `${o}–${c}`;
  return o ? `Opens ${o}` : '';
}

// ── Hours by weekday (Peta, 15 Nov 2026: "closed Sundays" must be possible) ──────────────────────
// A venue has its usual hours (opens/closes) and may override any weekday, including "closed".
// A weekday with no override uses the usual hours. All in Queensland time.

/** One weekday's override. day: 0 = Sunday … 6 = Saturday (as stored in gossoko.venue_hours). */
export interface DayHours { day: number; opens: string | null; closes: string | null; closed: boolean }

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
/** Monday first, the way a shop writes its hours. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** 0 = Sunday … 6 = Saturday, in Brisbane. */
export function brisbaneWeekday(at: Date): number {
  return new Date(at.getTime() + 10 * 3600_000).getUTCDay();
}

/** The hours that apply on a weekday: its override, else the usual hours. */
export function hoursOn(day: number, week: DayHours[] | null | undefined, opens: string | null | undefined, closes: string | null | undefined):
  { opens: string; closes: string; closed: boolean } {
  const o = week?.find((d) => d.day === day);
  if (o) return o.closed ? { opens: '', closes: '', closed: true } : { opens: o.opens ?? '', closes: o.closes ?? '', closed: false };
  return { opens: opens ?? '', closes: closes ?? '', closed: false };
}

/** Open right now, by weekday hours: today's window, or last night's window that runs past midnight. */
export function isOpenWeek(week: DayHours[] | null | undefined, opens: string | null | undefined, closes: string | null | undefined, at: Date = new Date()): boolean {
  if (!week?.length) return isOpenAt(opens, closes, at);
  const wd = brisbaneWeekday(at);
  const now = brisbaneMinutes(at);
  const today = hoursOn(wd, week, opens, closes);
  if (!today.closed) {
    if (isOpen24h(today.opens, today.closes)) return true;
    const o = toMinutes(today.opens), c = toMinutes(today.closes);
    if (o != null && c != null && (c > o ? now >= o && now < c : now >= o)) return true;
  }
  const y = hoursOn((wd + 6) % 7, week, opens, closes);
  if (!y.closed && !isOpen24h(y.opens, y.closes)) {
    const o = toMinutes(y.opens), c = toMinutes(y.closes);
    if (o != null && c != null && c < o && now < c) return true;
  }
  return false;
}
