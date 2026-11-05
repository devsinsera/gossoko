import { supabase } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/permissions';
import { invalidate } from '@/lib/useLoad';

export const VENUE_TYPES = [
  'cafe', 'food_truck', 'bakery', 'servo', 'gossoko_van',
  'snack_bar', 'restaurant', 'cafe_and_food_truck',
] as const;
type VenueTypeValue = (typeof VENUE_TYPES)[number];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export type SubmitVenueResult = { ok: true } | { ok: false; error: string; unauthenticated?: boolean };

export async function submitVenue(form: FormData): Promise<SubmitVenueResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in to add a venue', unauthenticated: true };

  const name = String(form.get('name') ?? '').trim();
  const suburb = String(form.get('suburb') ?? '').trim();
  const state = String(form.get('state') ?? '').trim() || 'QLD';
  const address = String(form.get('address') ?? '').trim();
  const type = String(form.get('type') ?? '') as VenueTypeValue;
  const tagline = String(form.get('tagline') ?? '').trim();
  const opensAt = String(form.get('opens_at') ?? '').trim();
  const closesAt = String(form.get('closes_at') ?? '').trim();
  const priceLevel = Number(String(form.get('price_level') ?? '2'));
  const latitude = Number(String(form.get('latitude') ?? '').trim());
  const longitude = Number(String(form.get('longitude') ?? '').trim());

  if (name.length < 2) return { ok: false, error: 'Venue name is too short.' };
  if (suburb.length < 2) return { ok: false, error: 'Suburb is required.' };
  if (address.length < 4) return { ok: false, error: 'Address is required.' };
  if (!VENUE_TYPES.includes(type)) return { ok: false, error: 'Pick a venue type.' };
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, error: 'Latitude must be a number between -90 and 90.' };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, error: 'Longitude must be a number between -180 and 180.' };
  }
  if (![1, 2, 3].includes(priceLevel)) return { ok: false, error: 'Price level must be 1, 2 or 3.' };
  const timeOk = (t: string) => t === '' || /^\d{2}:\d{2}$/.test(t);
  if (!timeOk(opensAt) || !timeOk(closesAt)) return { ok: false, error: 'Opening times must be HH:MM (24h).' };

  // Slug: name + suburb with a short random suffix to dodge the unique index.
  const base = [slugify(name), slugify(suburb)].filter(Boolean).join('-') || 'venue';
  const slug = `${base}-${crypto.randomUUID().slice(0, 6)}`.slice(0, 80);

  const { error } = await supabase().from('venues').insert({
    name, suburb, state, address, type, latitude, longitude,
    price_level: priceLevel,
    tagline: tagline || null,
    opens_at: opensAt || null,
    closes_at: closesAt || null,
    slug,
    created_by: user.id,
    // moderation_status defaults to 'pending' in the schema.
  });
  if (error) {
    console.error('[gossoko] submitVenue insert failed:', error.message);
    return { ok: false, error: error.message };
  }
  invalidate();
  return { ok: true };
}
