export interface SeedRow {
  slug: string; name: string; type: string; address: string; suburb: string; state: string;
  postcode?: string; latitude: number; longitude: number; placeholder?: boolean;
}
export interface PlanStep { slug: string; name: string; venueId?: string; action: 'create+grant' | 'grant' | 'skip'; why?: string }
export const FOUNDING_NOTE: string;
export const VENUE_TYPES: string[];
export function validateRows(rows: unknown): string[];
export function placeholders(rows: SeedRow[]): string[];
export function planSeed(
  rows: SeedRow[],
  venues: Map<string, { id: string; pro_until: string | null }>,
  plans: Map<string, { status: string; source: string; note: string | null; current_period_end?: string }>,
  now?: Date,
): PlanStep[];
export function toSql(rows: SeedRow[], days: number, actor?: string | null): string;
