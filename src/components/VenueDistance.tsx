
import { formatKm } from '@/lib/geo';
import { useDistanceKm } from './DistanceProvider';

/**
 * Renders a venue's distance from the device as "1.2km", or "—" until the
 * phone shares its location (a stored distance would be from somewhere else).
 */
export function VenueDistance({ lat, lng }: { lat: number; lng: number }) {
  const km = useDistanceKm(lat, lng, Number.NaN);
  return <>{Number.isFinite(km) ? formatKm(km) : '—'}</>;
}
