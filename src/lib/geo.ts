// Geo helpers shared by client distance components.
// No external deps — plain haversine over WGS-84 mean Earth radius.

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance in kilometres between two lat/lng points.
 * Returns 0 for identical points; NaN-safe is the caller's concern.
 */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Format a distance the same way the static seed values read: "1.2km". */
export function formatKm(km: number): string {
  // One decimal, but drop a trailing ".0" so whole numbers stay tidy.
  const rounded = Math.round(km * 10) / 10;
  return `${rounded}km`;
}

/** A link that opens turn-by-turn directions in the phone's maps app (Apple Maps on iPhone/iPad/Mac, Google Maps elsewhere). */
export function directionsUrl(lat: number, lng: number, name: string): string {
  const apple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
  const label = encodeURIComponent(name);
  return apple
    ? `https://maps.apple.com/?daddr=${lat},${lng}&q=${label}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/**
 * `?near=lat,lng` from a link another app made (e.g. Callout: "food near this job") → a point, or null
 * when it's missing or nonsense. Only Australia-ish coordinates are taken.
 */
export function parseNear(value: string | null | undefined): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(value ?? '');
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!(lat <= -9 && lat >= -45 && lng >= 112 && lng <= 155)) return null;
  return { lat, lng };
}
