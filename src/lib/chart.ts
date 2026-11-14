// The owner dashboard's views-per-day chart, as plain data the component draws with divs.

export interface DayBar {
  date: string;
  /** "Mon" for a week, "14/11" for longer ranges; '' where the axis skips a label. */
  label: string;
  value: number;
  /** Bar height, 0–100 (% of the busiest day). */
  pct: number;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-11-14" read as a calendar day (no timezone shift). */
function day(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function dayBars(daily: { date: string; views: number }[]): DayBar[] {
  const n = daily.length;
  const max = Math.max(0, ...daily.map((d) => d.views || 0));
  // At most ~7 labels under the bars; always label the last day (today).
  const every = Math.max(1, Math.ceil(n / 7));
  return daily.map((d, i) => {
    const dt = day(d.date);
    const show = (n - 1 - i) % every === 0;
    const label = !dt || !show ? '' : n <= 7 ? WEEKDAY[dt.getDay()] : `${dt.getDate()}/${dt.getMonth() + 1}`;
    const value = d.views || 0;
    return { date: d.date, label, value, pct: max > 0 ? Math.round((value / max) * 100) : 0 };
  });
}

/** True when there is nothing to draw (no days, or no views on any day). */
export function chartEmpty(daily: { views: number }[]): boolean {
  return !daily.some((d) => (d.views || 0) > 0);
}
