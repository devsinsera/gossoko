// The website's front page (/gossoko/): the Log in button and a small live taste of the app.
// Plain fetch against the public API (the anon key is public by design; RLS decides what is readable),
// so the page stays light and does not pull in the app bundle.
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const APP = '/gossoko/admin/';

type Row = { id: string; slug: string; name: string; type: string | null; suburb: string | null; tagline: string | null; rating: number | null; review_count: number | null };

/** Already signed in on this browser: Log in goes straight to the app. */
export function signedIn(store: Pick<Storage, 'getItem'> | undefined): boolean {
  try { return Boolean(store?.getItem('gossoko.auth')); } catch { return false; }
}

async function get<T>(path: string): Promise<T[]> {
  if (!URL_ || !KEY) return [];
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Accept-Profile': 'gossoko' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T[];
}

const COLS = 'id,slug,name,type,suburb,tagline,rating,review_count';

/** Shops with a live Featured slot; else the best-rated shops that have reviews; else listed shops. */
export type ShopList = { kind: 'featured' | 'top' | 'listed'; shops: Row[] };
export const SHOP_TITLES: Record<ShopList['kind'], string> = { featured: 'Featured shops', top: 'Top rated right now', listed: 'Shops on Gossoko' };

export async function loadShops(now = new Date()): Promise<ShopList> {
  const iso = encodeURIComponent(now.toISOString());
  const slots = await get<{ venue_id: string }>(`featured_venues?select=venue_id&deleted_at=is.null&start_date=lte.${iso}&end_date=gt.${iso}`);
  const ids = [...new Set(slots.map((s) => s.venue_id))];
  if (ids.length > 0) {
    const shops = await get<Row>(`venues?select=${COLS}&deleted_at=is.null&id=in.(${ids.join(',')})&limit=6`);
    if (shops.length > 0) return { kind: 'featured', shops };
  }
  const shops = await get<Row>(`venues?select=${COLS}&deleted_at=is.null&review_count=gt.0&order=rating.desc.nullslast,review_count.desc&limit=6`);
  if (shops.length > 0) return { kind: 'top', shops };
  // Early days: nothing reviewed yet. Show listed shops, without scores.
  return { kind: 'listed', shops: await get<Row>(`venues?select=${COLS}&deleted_at=is.null&order=is_verified.desc,name.asc&limit=6`) };
}

function card(s: Row): HTMLElement {
  const a = document.createElement('a');
  a.className = 'card shop';
  a.href = `${APP}venue/${encodeURIComponent(s.slug)}`;
  const h = document.createElement('h3'); h.textContent = s.name;
  const where = document.createElement('p'); where.className = 'shop__where';
  where.textContent = [s.type, s.suburb].filter(Boolean).join(' · ');
  a.append(h, where);
  if (s.tagline) { const t = document.createElement('p'); t.textContent = s.tagline; a.append(t); }
  if (s.rating != null && (s.review_count ?? 0) > 0) {
    const r = document.createElement('p'); r.className = 'shop__score';
    r.textContent = `${Number(s.rating).toFixed(1)} / 5 from ${s.review_count} review${s.review_count === 1 ? '' : 's'}`;
    a.append(r);
  }
  return a;
}

function start(): void {
  if (signedIn(window.localStorage)) {
    document.querySelectorAll<HTMLAnchorElement>('a[data-login]').forEach((a) => { a.href = APP; a.textContent = 'Open the app'; });
  }
  const section = document.getElementById('shops');
  const list = document.getElementById('shops-list');
  const title = document.getElementById('shops-title');
  if (!section || !list || !title) return;
  loadShops().then(({ kind, shops }) => {
    if (shops.length === 0) return;            // nothing real to show: the section stays hidden
    title.textContent = SHOP_TITLES[kind];
    list.replaceChildren(...shops.map(card));
    section.hidden = false;
  }).catch((e) => console.error('[gossoko] shops failed:', e instanceof Error ? e.message : e));
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
