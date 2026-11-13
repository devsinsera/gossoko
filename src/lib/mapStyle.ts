// Map style: OpenFreeMap's dark vector style (free, no key, commercial use allowed),
// recoloured to the Gossoko palette — near-black ground, coffee water and parks,
// burnt-orange roads, cream labels.
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

const P = {
  ground: '#0d0b09',
  residential: '#130f0c',
  park: '#16130c',
  wood: '#15120b',
  water: '#1d130c',
  waterLine: '#2c1c11',
  building: '#1b1510',
  minor: '#2a2018',
  major: '#5a3014',
  motorway: '#a8490c',
  rail: '#33281e',
  label: '#d9c6ad',
  labelMinor: '#9a8670',
  halo: '#0a0908',
} as const;

/** Paint overrides by layer id. Anything not listed keeps OpenFreeMap's dark paint. */
function paintFor(layer: LayerSpecification): Record<string, unknown> | null {
  const id = layer.id;
  if (layer.type === 'background') return { 'background-color': P.ground };
  if (id === 'water') return { 'fill-color': P.water };
  if (id === 'waterway') return { 'line-color': P.waterLine };
  if (id === 'landuse_residential') return { 'fill-color': P.residential };
  if (id === 'landuse_park') return { 'fill-color': P.park };
  if (id === 'landcover_wood') return { 'fill-color': P.wood };
  if (id === 'building') return { 'fill-color': P.building, 'fill-outline-color': P.ground };
  if (id.startsWith('highway_motorway')) return id.endsWith('casing') ? { 'line-color': P.ground } : { 'line-color': P.motorway };
  if (id.startsWith('highway_major')) return id.endsWith('casing') ? { 'line-color': P.ground } : { 'line-color': P.major };
  if (id === 'highway_minor' || id === 'highway_path' || id === 'road_pier') return { 'line-color': P.minor };
  if (id.startsWith('railway')) return { 'line-color': P.rail };
  if (layer.type === 'symbol') {
    const minor = id.startsWith('highway_name') || id === 'place_other' || id === 'water_name' || id.startsWith('road_');
    return { 'text-color': minor ? P.labelMinor : P.label, 'text-halo-color': P.halo };
  }
  return null;
}

/** Fetch the base style and recolour it. Throws with the HTTP status if the style can't load. */
export async function loadBrandStyle(signal?: AbortSignal): Promise<StyleSpecification> {
  const res = await fetch(MAP_STYLE_URL, { signal });
  if (!res.ok) throw new Error(`Map style failed to load (HTTP ${res.status})`);
  const style = (await res.json()) as StyleSpecification;
  style.layers = style.layers
    // The shaded-relief raster only shows at world zoom and reads as grey noise on the brand ground.
    .filter((l) => !('source' in l && l.source === 'ne2_shaded'))
    .map((l) => {
      const over = paintFor(l);
      if (!over) return l;
      return { ...l, paint: { ...(('paint' in l && l.paint) || {}), ...over } } as LayerSpecification;
    });
  return style;
}
