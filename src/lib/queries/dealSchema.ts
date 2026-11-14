// Deal scheduling (venue_specials.days_of_week, migration 20261115000002) may not be on the database
// yet: the web can ship before the migration. Every read that wants the new column goes through
// withSchedule(), which falls back to the old columns when the database says the column isn't there,
// so the deal list, Get code and the owner dashboard keep working either way.

type DbError = { code?: string; message?: string } | null | undefined;

/** PostgREST/Postgres "no such column" (select: 42703; insert/update: PGRST204 schema cache). */
export function isMissingColumn(e: DbError, column = 'days_of_week'): boolean {
  if (!e) return false;
  if (e.code === '42703' || e.code === 'PGRST204') return (e.message ?? '').includes(column) || !e.message;
  return false;
}

const KEY = 'gossoko.schedule.missing';
function ss(): Storage | null { try { return sessionStorage; } catch { return null; } }
// "Missing" is remembered for this tab (one failed probe per visit, not per page load).
let supported: boolean | null = ss()?.getItem(KEY) === '1' ? false : null;
/** true / false once known; null until a read has told us. */
export function scheduleSupported(): boolean | null { return supported; }
export function markSchedule(on: boolean): void {
  supported = on;
  try { if (on) ss()?.removeItem(KEY); else ss()?.setItem(KEY, '1'); } catch { /* private mode */ }
}
/** Tests only. */
export function resetScheduleSupport(): void { supported = null; try { ss()?.removeItem(KEY); } catch { /* none */ } }

/**
 * Run `run(true)` (new columns) unless we already know they're missing; on a missing-column error,
 * remember it and run `run(false)` (old columns).
 */
export async function withSchedule<T extends { error: DbError }>(run: (withDays: boolean) => PromiseLike<T>): Promise<T> {
  if (supported === false) return run(false);
  const r = await run(true);
  if (isMissingColumn(r.error)) { markSchedule(false); return run(false); }
  if (!r.error) supported = true;
  return r;
}
