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

/** Open at this moment (the device's local time), including windows that cross midnight. */
export function isOpenAt(opens: string | null | undefined, closes: string | null | undefined, at: Date = new Date()): boolean {
  const o = toMinutes(opens);
  const c = toMinutes(closes);
  if (o == null || c == null) return false;
  if (isOpen24h(opens, closes)) return true;
  const now = at.getHours() * 60 + at.getMinutes();
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
