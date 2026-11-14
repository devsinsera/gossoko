// When a deal runs: start/end window plus optional weekdays (Brisbane time, like the database's
// gossoko.deal_runs_at). Pure functions so they can be tested.

export interface DealWindow {
  start_date: string;
  end_date: string;
  /** ISO weekdays (1 = Mon … 7 = Sun); null = every day. */
  days_of_week?: number[] | null;
  /** Ended early by the owner. */
  deleted_at?: string | null;
}

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BNE_OFFSET_MS = 10 * 3600_000; // Queensland: UTC+10 all year, no daylight saving

/** ISO weekday (1 = Mon … 7 = Sun) in Brisbane at `at`. */
export function brisbaneDow(at: Date | number): number {
  const d = new Date((typeof at === 'number' ? at : at.getTime()) + BNE_OFFSET_MS).getUTCDay();
  return d === 0 ? 7 : d;
}

/** A datetime-local value ("2026-11-23T06:00") read as Brisbane time → ISO; null if empty or invalid. */
export function brisbaneLocalToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const t = Date.parse(`${value}:00+10:00`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** ISO time → a datetime-local value in Brisbane time. */
export function isoToBrisbaneLocal(iso: string | number): string {
  return new Date((typeof iso === 'number' ? iso : Date.parse(iso)) + BNE_OFFSET_MS).toISOString().slice(0, 16);
}

export function dealRunsAt(d: DealWindow, at: number = Date.now()): boolean {
  if (d.deleted_at) return false;
  if (!(Date.parse(d.start_date) <= at && Date.parse(d.end_date) > at)) return false;
  const days = d.days_of_week;
  return !days || days.length === 0 || days.includes(brisbaneDow(at));
}

export type DealState = 'live' | 'scheduled' | 'not-today' | 'finished';

/** A deal posted "now" gets the server's clock as its start; a phone a little behind must still call it live. */
export const CLOCK_SKEW_MS = 2 * 60_000;

/** live = can be claimed now; scheduled = starts later; not-today = in its window but today is a day off. */
/** `skewMs`: only the owner's dashboard passes CLOCK_SKEW_MS (a deal they just posted shows as live);
 *  customer lists use 0, so Get code never shows before the server says the deal has started. */
export function dealState(d: DealWindow, now: number = Date.now(), skewMs = 0): DealState {
  if (d.deleted_at || Date.parse(d.end_date) <= now) return 'finished';
  if (Date.parse(d.start_date) > now + skewMs) return 'scheduled';
  return dealRunsAt(d, Math.max(now, Date.parse(d.start_date))) ? 'live' : 'not-today';
}

/** "Mon–Wed", "Mon, Wed, Fri", "Every day". */
export function daysLabel(days: number[] | null | undefined): string {
  if (!days || days.length === 0 || days.length === 7) return 'Every day';
  const s = [...new Set(days)].filter((n) => n >= 1 && n <= 7).sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    runs.push(j - i >= 2 ? `${DAY[s[i] - 1]}–${DAY[s[j] - 1]}` : s.slice(i, j + 1).map((n) => DAY[n - 1]).join(', '));
    i = j + 1;
  }
  return runs.join(', ');
}

export const WEEKDAYS = DAY.map((label, i) => ({ value: i + 1, label }));
