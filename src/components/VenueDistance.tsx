'use client';

import { formatKm } from '@/lib/geo';
import { useDistanceKm } from './DistanceProvider';

/**
 * Renders a venue's distance as "1.2km". Shows the real device-relative
 * haversine distance once geolocation resolves, falling back to the static
 * seeded `distance_km` otherwise. Drop-in replacement for `{venue.distance_km}km`.
 */
export function VenueDistance({
  lat,
  lng,
  fallbackKm,
}: {
  lat: number;
  lng: number;
  fallbackKm: number;
}) {
  const km = useDistanceKm(lat, lng, fallbackKm);
  return <>{formatKm(km)}</>;
}
