import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { haversineKm, parseNear } from '@/lib/geo';

type Coords = { lat: number; lng: number };

const CoordsContext = createContext<Coords | null>(null);
const NearContext = createContext<{ near: Coords | null; clearNear: () => void }>({ near: null, clearNear: () => {} });

/**
 * Wraps the app shell. On mount (after hydration) it asks the browser for the
 * device location. Children render immediately with static fallbacks; once (if)
 * the user grants permission, consumers re-render with real distances.
 *
 * A link with `?near=lat,lng` (another app's "food near this job") measures from that spot
 * instead, for the rest of the visit, until "Use my location" clears it.
 *
 * Never blocks render and never throws — any denial / timeout / unsupported
 * browser leaves `coords` as null, so consumers keep their static fallback.
 */
export function DistanceProvider({ children }: { children: React.ReactNode }) {
  const [device, setDevice] = useState<Coords | null>(null);
  const { search } = useLocation();
  const [near, setNear] = useState<Coords | null>(() => parseNear(new URLSearchParams(search).get('near')));

  useEffect(() => {
    const n = parseNear(new URLSearchParams(search).get('near'));
    if (n) setNear(n);
  }, [search]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setDevice({ lat: pos.coords.latitude, lng: pos.coords.longitude });
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

  const clearNear = useCallback(() => setNear(null), []);
  return (
    <NearContext.Provider value={{ near, clearNear }}>
      <CoordsContext.Provider value={near ?? device}>{children}</CoordsContext.Provider>
    </NearContext.Provider>
  );
}

/** Where distances are measured from: a linked `?near=` spot, else the device; null when unknown. */
export function useCoords(): Coords | null {
  return useContext(CoordsContext);
}

/** The linked `?near=` spot (null when measuring from the device) and a way back to the device. */
export function useNear(): { near: Coords | null; clearNear: () => void } {
  return useContext(NearContext);
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
