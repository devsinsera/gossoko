import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBrandStyle, MAP_STYLE_URL } from '@/lib/mapStyle';

const BASE = {
  version: 8,
  sources: { ne2_shaded: { type: 'raster', tiles: [] }, openmaptiles: { type: 'vector', url: 'x' } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#000' } },
    { id: 'ne2_shaded', type: 'raster', source: 'ne2_shaded' },
    { id: 'water', type: 'fill', source: 'openmaptiles', paint: { 'fill-color': '#00f', 'fill-opacity': 0.5 } },
    { id: 'highway_motorway_inner', type: 'line', source: 'openmaptiles', paint: { 'line-color': '#fff', 'line-width': 2 } },
    { id: 'place_city', type: 'symbol', source: 'openmaptiles', paint: { 'text-color': '#fff' } },
    { id: 'aeroway-area', type: 'fill', source: 'openmaptiles', paint: { 'fill-color': '#123' } },
  ],
};

afterEach(() => { vi.unstubAllGlobals(); });

describe('loadBrandStyle', () => {
  it('recolours the OpenFreeMap dark style to the brand and keeps other paint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(BASE), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const style = await loadBrandStyle();
    expect(fetchMock).toHaveBeenCalledWith(MAP_STYLE_URL, expect.anything());
    const byId = Object.fromEntries(style.layers.map((l) => [l.id, l as { paint?: Record<string, unknown> }]));
    expect(byId.ne2_shaded).toBeUndefined();
    expect(byId.background.paint?.['background-color']).toBe('#0d0b09');
    expect(byId.water.paint).toEqual({ 'fill-color': '#1d130c', 'fill-opacity': 0.5 });
    expect(byId.highway_motorway_inner.paint).toEqual({ 'line-color': '#a8490c', 'line-width': 2 });
    expect(byId.place_city.paint?.['text-color']).toBe('#d9c6ad');
    expect(byId['aeroway-area'].paint).toEqual({ 'fill-color': '#123' });
  });

  it('surfaces a failed style load as an error, not an empty map', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    await expect(loadBrandStyle()).rejects.toThrow('HTTP 503');
  });
});
