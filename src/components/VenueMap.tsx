import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import pinUrl from '@/assets/brand/gossoko-pin.svg';
import { Link } from '@/lib/nav';
import type { Venue } from '@/lib/types';
import { VENUE_TYPE_LABELS } from '@/lib/types';
import { loadBrandStyle } from '@/lib/mapStyle';
import { directionsUrl } from '@/lib/geo';
import { trackVenueEvent } from '@/lib/queries/business';
import { displayScore } from '@/lib/ranking';
import { useCoords } from './DistanceProvider';
import { VenueDistance } from './VenueDistance';
import { ChevronRightIcon, CompassIcon, StarIcon } from './icons';

/** Brisbane CBD — the view before any venue or location is known. */
const FALLBACK_CENTER: [number, number] = [153.026, -27.4698];

type MapLib = typeof import('maplibre-gl');
let libPromise: Promise<MapLib> | null = null;

/** MapLibre (CSP build, worker served from our own origin), loaded only when a map is on screen. */
function loadMapLib(): Promise<MapLib> {
  libPromise ??= Promise.all([
    import('maplibre-gl/dist/maplibre-gl-csp'),
    import('maplibre-gl/dist/maplibre-gl-csp-worker.js?url'),
  ]).then(([mod, worker]) => {
    const lib = ((mod as { default?: MapLib }).default ?? mod) as MapLib;
    lib.setWorkerUrl(worker.default);
    return lib;
  }).catch((e) => {
    libPromise = null;
    throw e;
  });
  return libPromise;
}

function hasCoords(v: Venue): boolean {
  return Number.isFinite(v.lat) && Number.isFinite(v.lng) && !(v.lat === 0 && v.lng === 0);
}

function pinElement(v: Venue, onPick: () => void): HTMLElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'map-pin';
  b.setAttribute('aria-label', `Show ${v.name}`);
  const img = document.createElement('img');
  img.src = pinUrl;
  img.alt = '';
  img.draggable = false;
  b.appendChild(img);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onPick();
  });
  return b;
}

/**
 * The real map on the Nearby page: brand-tinted vector map, the Gossoko pin for every
 * venue, a dot for the phone's location, and the picked venue's card underneath.
 */
export function VenueMap({ venues }: { venues: Venue[] }) {
  const coords = useCoords();
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const libRef = useRef<MapLib | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const youRef = useRef<Marker | null>(null);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const mapped = venues.filter(hasCoords);
  const sel = mapped.find((v) => v.id === selected) ?? null;

  // Create the map once.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ctl = new AbortController();
    let map: MLMap | null = null;
    (async () => {
      try {
        const [lib, style] = await Promise.all([loadMapLib(), loadBrandStyle(ctl.signal)]);
        if (ctl.signal.aborted) return;
        libRef.current = lib;
        map = new lib.Map({
          container: box,
          style,
          center: FALLBACK_CENTER,
          zoom: 11,
          attributionControl: { compact: false },
          dragRotate: false,
          pitchWithRotate: false,
          cooperativeGestures: false,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
        map.on('error', (e) => {
          // Tile hiccups are retried by MapLibre; only a dead style is fatal.
          if (!map?.isStyleLoaded() && e.error) setError(e.error.message || 'The map could not load.');
        });
        map.once('load', () => {
          mapRef.current = map;
          setReady(true);
        });
      } catch (e) {
        if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : 'The map could not load.');
      }
    })();
    return () => {
      ctl.abort();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      youRef.current?.remove();
      youRef.current = null;
      map?.remove();
      mapRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // Venue pins follow the (filtered) list.
  const key = mapped.map((v) => v.id).join(',');
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    const keep = new Set(mapped.map((v) => v.id));
    markersRef.current.forEach((m, id) => {
      if (!keep.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    });
    for (const v of mapped) {
      if (markersRef.current.has(v.id)) continue;
      const m = new lib.Marker({ element: pinElement(v, () => setSelected(v.id)), anchor: 'bottom' })
        .setLngLat([v.lng, v.lat])
        .addTo(map);
      markersRef.current.set(v.id, m);
    }
    if (selected && !keep.has(selected)) setSelected(null);
    // Frame the venues (and the phone, once known) the first time, and again when the filter changes.
    fitTo(map, lib, mapped, coords);
    fittedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  // The phone's own location.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib || !coords) return;
    if (!youRef.current) {
      const el = document.createElement('div');
      el.className = 'map-you';
      el.setAttribute('aria-label', 'You are here');
      youRef.current = new lib.Marker({ element: el }).setLngLat([coords.lng, coords.lat]).addTo(map);
    } else {
      youRef.current.setLngLat([coords.lng, coords.lat]);
    }
  }, [ready, coords]);

  // Highlight the picked pin and bring it into view.
  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const el = m.getElement();
      el.classList.toggle('is-selected', id === selected);
      el.style.zIndex = id === selected ? '3' : '1';
    });
    const map = mapRef.current;
    if (map && sel) map.easeTo({ center: [sel.lng, sel.lat], duration: 450 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, ready]);

  const recentre = () => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    if (coords) map.easeTo({ center: [coords.lng, coords.lat], zoom: Math.max(map.getZoom(), 13), duration: 500 });
    else fitTo(map, lib, mapped, null);
  };

  return (
    <div className="map-card">
      <div className="map-canvas" style={{ position: 'relative' }}>
        <div ref={boxRef} style={{ position: 'absolute', inset: 0 }} />
        {!ready && !error && (
          <div className="map-overlay" aria-live="polite">
            <span className="pin-loader" aria-hidden><img src={pinUrl} alt="" /></span>
            <span>Loading map…</span>
          </div>
        )}
        {error && (
          <div className="map-overlay" role="alert">
            <strong>Map unavailable</strong>
            <span>{error}</span>
          </div>
        )}
        {ready && (
          <button type="button" className="map-locate" onClick={recentre} aria-label={coords ? 'Centre on me' : 'Show all venues'}>
            <CompassIcon size={18} />
          </button>
        )}
        {ready && mapped.length < venues.length && (
          <span className="map-note">{venues.length - mapped.length} without a location</span>
        )}
      </div>

      {sel ? (
        <div className="map-panel">
          <Link href={`/venue/${sel.slug}`} className="map-panel__main">
            <span className="map-panel__pin" aria-hidden><img src={pinUrl} alt="" /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="map-panel__name">{sel.name}</span>
              <span className="map-panel__meta">
                {VENUE_TYPE_LABELS[sel.venue_type]} · {sel.suburb} · <VenueDistance lat={sel.lat} lng={sel.lng} />
                {displayScore(sel) ? <> · <StarIcon size={11} filled /> {displayScore(sel)}</> : ' · No reviews yet'}
              </span>
            </span>
            <ChevronRightIcon size={20} />
          </Link>
          <a
            className="btn btn--solid btn--sm"
            href={directionsUrl(sel.lat, sel.lng, sel.name)}
            target="_blank"
            rel="noopener"
            onClick={() => trackVenueEvent(sel.id, 'directions')}
          >
            Directions
          </a>
        </div>
      ) : (
        <p className="map-hint">Tap a pin to see the spot.</p>
      )}
    </div>
  );
}

function fitTo(map: MLMap, lib: MapLib, venues: Venue[], you: { lat: number; lng: number } | null) {
  const pts: [number, number][] = venues.map((v) => [v.lng, v.lat]);
  if (you) pts.push([you.lng, you.lat]);
  if (pts.length === 0) return;
  if (pts.length === 1) {
    map.easeTo({ center: pts[0], zoom: 14, duration: 0 });
    return;
  }
  const b = new lib.LngLatBounds(pts[0], pts[0]);
  for (const p of pts) b.extend(p);
  map.fitBounds(b, { padding: { top: 60, bottom: 30, left: 40, right: 40 }, maxZoom: 15, duration: 0 });
}
