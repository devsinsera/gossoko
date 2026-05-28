'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { haversineKm } from '@/lib/geo';

type Coords = { lat: number; lng: number };

const CoordsContext = createContext<Coords | null>(null);

/**
 * Wraps the app shell. On mount (after hydration) it asks the browser for the
 * device location. Children render immediately with static fallbacks; once (if)
 * the user grants permission, consumers re-render with real distances.
 *
 * Never blocks render and never throws — any denial / timeout / unsupported
 * browser leaves `coords` as null, so consumers keep their static fallback.
 */
export function DistanceProvider({ children }: { children: React.ReactNode }) {
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // Denied / position unavailable / timeout — stay on static fallback.
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return <CoordsContext.Provider value={coords}>{children}</CoordsContext.Provider>;
}

/** Raw device coords, or null when geolocation is unavailable/denied/pending. */
export function useCoords(): Coords | null {
  return useContext(CoordsContext);
}

/**
 * Real haversine distance (km) from the device to (lat, lng) when coords are
 * available; otherwise the supplied static fallback. Pure number — callers
 * format with formatKm().
 */
export function useDistanceKm(lat: number, lng: number, fallbackKm: number): number {
  const coords = useCoords();
  if (!coords || !Number.isFinite(lat) || !Number.isFinite(lng)) return fallbackKm;
  return haversineKm(coords.lat, coords.lng, lat, lng);
}
