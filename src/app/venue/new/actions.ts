'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/permissions';

const VENUE_TYPES = [
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

function backToForm(params: URLSearchParams): never {
  redirect(`/venue/new?${params.toString()}`);
}

export async function submitVenue(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/venue/new')}`);
  }

  const name = String(formData.get('name') ?? '').trim();
  const suburb = String(formData.get('suburb') ?? '').trim();
  const state = String(formData.get('state') ?? '').trim() || 'QLD';
  const address = String(formData.get('address') ?? '').trim();
  const type = String(formData.get('type') ?? '') as VenueTypeValue;
  const tagline = String(formData.get('tagline') ?? '').trim();
  const opensAt = String(formData.get('opens_at') ?? '').trim();
  const closesAt = String(formData.get('closes_at') ?? '').trim();
  const priceLevelRaw = String(formData.get('price_level') ?? '2');
  const latRaw = String(formData.get('latitude') ?? '').trim();
  const lngRaw = String(formData.get('longitude') ?? '').trim();

  // Echo user input back into the form when redirecting on validation error.
  const echo = new URLSearchParams();
  if (name) echo.set('name', name);
  if (suburb) echo.set('suburb', suburb);
  if (state) echo.set('state', state);
  if (address) echo.set('address', address);
  if (type) echo.set('type', type);
  if (tagline) echo.set('tagline', tagline);
  if (opensAt) echo.set('opens_at', opensAt);
  if (closesAt) echo.set('closes_at', closesAt);
  if (priceLevelRaw) echo.set('price_level', priceLevelRaw);
  if (latRaw) echo.set('latitude', latRaw);
  if (lngRaw) echo.set('longitude', lngRaw);

  const fail = (msg: string): never => {
    echo.set('error', msg);
    backToForm(echo);
  };

  if (name.length < 2) fail('Venue name is too short.');
  if (suburb.length < 2) fail('Suburb is required.');
  if (address.length < 4) fail('Address is required.');
  if (!VENUE_TYPES.includes(type)) fail('Pick a venue type.');

  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    fail('Latitude must be a number between -90 and 90.');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    fail('Longitude must be a number between -180 and 180.');
  }

  const priceLevel = Number(priceLevelRaw);
  if (![1, 2, 3].includes(priceLevel)) fail('Price level must be 1, 2 or 3.');

  // Times are optional; if provided, they must look like HH:MM.
  const timeOk = (t: string) => t === '' || /^\d{2}:\d{2}$/.test(t);
  if (!timeOk(opensAt) || !timeOk(closesAt)) fail('Opening times must be HH:MM (24h).');

  // Slug: base from name+suburb, with a short suffix to dodge the unique index.
  const base = [slugify(name), slugify(suburb)].filter(Boolean).join('-') || 'venue';
  const suffix = crypto.randomUUID().slice(0, 6);
  const slug = `${base}-${suffix}`.slice(0, 80);

  const supabase = await createClient();
  const { error } = await supabase.from('venues').insert({
    name,
    suburb,
    state,
    address,
    type,
    latitude,
    longitude,
    price_level: priceLevel,
    tagline: tagline || null,
    opens_at: opensAt || null,
    closes_at: closesAt || null,
    slug,
    created_by: user.id,
    // moderation_status defaults to 'pending' in the schema — no need to set it.
  });

  if (error) {
    console.error('[gossoko] submitVenue insert failed:', error.message);
    fail(error.message);
  }

  revalidatePath('/admin/moderation');
  redirect('/profile?venue=submitted');
}
