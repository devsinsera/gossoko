// Address → map position for an owner fixing their listing. Uses OpenStreetMap's Nominatim, only
// when the owner taps "Find on map" (one request; their usage policy allows light use like this).
// Only the venue's business address is sent. Listed in the privacy policy's providers.

export interface GeoHit { lat: number; lng: number; label: string }

/** The query sent for a venue address (Australia only). */
export function geocodeQuery(a: { address: string; suburb: string; postcode?: string; state?: string }): string {
  return [a.address, a.suburb, a.state || 'QLD', a.postcode, 'Australia'].map((x) => (x ?? '').trim()).filter(Boolean).join(', ');
}

/** Rough South-East Queensland box: a hit outside it is almost certainly the wrong street. */
export function inSeq(lat: number, lng: number): boolean {
  return lat <= -25.5 && lat >= -28.7 && lng >= 151.5 && lng <= 153.7;
}

export async function geocodeAddress(
  a: { address: string; suburb: string; postcode?: string; state?: string }, fetcher: typeof fetch = fetch,
): Promise<{ ok: true; hit: GeoHit } | { ok: false; error: string }> {
  const q = geocodeQuery(a);
  if (a.address.trim().length < 4 || a.suburb.trim().length < 2) return { ok: false, error: 'Fill in the street address and suburb first.' };
  let res: Response;
  try {
    res = await fetcher(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=au&q=${encodeURIComponent(q)}`, {
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    return { ok: false, error: `Couldn't reach the map lookup: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!res.ok) return { ok: false, error: `The map lookup answered ${res.status}. Try again in a minute.` };
  const rows = (await res.json().catch(() => [])) as { lat: string; lon: string; display_name: string }[];
  const r = rows[0];
  if (!r) return { ok: false, error: 'No map position found for that address. Check the spelling, or use this phone’s location at the venue.' };
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: 'The map lookup sent back a bad position.' };
  if (!inSeq(lat, lng)) return { ok: false, error: `That address was found outside South-East Queensland (${r.display_name}). Check it.` };
  return { ok: true, hit: { lat, lng, label: r.display_name } };
}
