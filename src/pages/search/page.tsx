import { useMemo, useState } from 'react';
import { Link } from '@/lib/nav';
import { SearchBar } from '@/components/SearchBar';
import { FilterChips, DEFAULT_CHIPS } from '@/components/FilterChips';
import { PromotedSpots } from '@/components/PromotedSpots';
import { getAllVenues } from '@/lib/queries/venues';
import { useLoad } from '@/lib/useLoad';
import { applyFilter, searchVenues, type FilterId } from '@/lib/filters';
import { displayScore } from '@/lib/ranking';
import { COLORS } from '@/lib/theme';
import { ChevronRightIcon, MapPinIcon, StarIcon, SearchIcon } from '@/components/icons';
import { VenueDistance } from '@/components/VenueDistance';

const RECENT_KEY = 'gossoko.recent-searches';

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 5) : [];
  } catch { return []; }
}
function rememberSearch(q: string): string[] {
  const clean = q.trim();
  const next = [clean, ...readRecent().filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode: fine */ }
  return next;
}

const chipBtn = {
  padding: '8px 12px', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 999, color: COLORS.text,
  cursor: 'pointer', fontFamily: 'var(--font-label)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
} as const;

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [recent, setRecent] = useState<string[]>(readRecent);
  const { data } = useLoad(getAllVenues, []);
  const VENUES = useMemo(() => data ?? [], [data]);

  // Suburbs that actually have venues, busiest first.
  const suburbs = useMemo(() => {
    const n = new Map<string, number>();
    for (const v of VENUES) n.set(v.suburb, (n.get(v.suburb) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([s]) => s);
  }, [VENUES]);

  const searching = q.trim().length > 0;
  const results = useMemo(
    () => applyFilter(searching ? searchVenues(VENUES, q, 30) : VENUES, filter),
    [q, filter, VENUES, searching],
  );

  return (
    <>
      <header className="top-bar">
        <div>
          <h1>SEARCH</h1>
          <p className="top-bar__sub">Venues · suburbs · kinds of place</p>
        </div>
      </header>

      <SearchBar autoFocus value={q} onChange={setQ} placeholder="Search venues, suburbs, “coffee vans”…" />
      <div style={{ marginTop: 8 }}>
        <FilterChips chips={DEFAULT_CHIPS} onChange={setFilter} />
      </div>

      {!searching && filter === 'all' && (
        <>
          <PromotedSpots venues={VENUES} />
          {recent.length > 0 && (
            <section className="section">
              <div className="section-title">
                <h2>Recent</h2>
                <button type="button" onClick={() => { try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ } setRecent([]); }}
                  style={{ background: 'none', border: 'none', color: COLORS.textMuted, cursor: 'pointer', fontSize: 12 }}>Clear</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recent.map((r) => (
                  <button key={r} type="button" onClick={() => setQ(r)}
                    style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center', padding: '10px 12px', background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <SearchIcon size={14} style={{ color: COLORS.textMuted }} />
                    <span style={{ fontSize: 14 }}>{r}</span>
                    <ChevronRightIcon size={14} style={{ color: COLORS.textMuted }} />
                  </button>
                ))}
              </div>
            </section>
          )}
          {suburbs.length > 0 && (
            <section className="section">
              <div className="section-title"><h2>Suburbs</h2></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {suburbs.map((s) => (
                  <button key={s} type="button" onClick={() => setQ(s)} style={chipBtn}>
                    <MapPinIcon size={12} style={{ marginRight: 6, color: COLORS.orange }} />
                    {s}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {(searching || filter !== 'all') && (
        <section className="section">
          <div className="section-title">
            <h2>{results.length} {results.length === 1 ? 'result' : 'results'}{searching ? ` for “${q.trim()}”` : ''}</h2>
          </div>
          {results.length === 0 ? (
            <div style={{ padding: '28px 18px', background: COLORS.surface, border: `1px dashed ${COLORS.border}`, borderRadius: 12, textAlign: 'center' }}>
              <SearchIcon size={28} style={{ color: COLORS.textMuted }} />
              <p style={{ margin: '10px 0 0', fontSize: 14, color: COLORS.textSecondary }}>
                Nothing matches. Try a suburb, a venue name, or “coffee vans”.{' '}
                <Link href="/venue/new" style={{ color: COLORS.orange }}>Know a spot we&apos;re missing? Add it.</Link>
              </p>
            </div>
          ) : (
            <div className="row-list">
              {results.map((v) => (
                <Link key={v.id} href={`/venue/${v.slug}`} onClick={() => { if (searching) setRecent(rememberSearch(q)); }}
                  style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 12, alignItems: 'center', padding: '12px 14px', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, textDecoration: 'none' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'radial-gradient(circle at 50% 30%, rgba(255, 138, 26, 0.45), rgba(142, 74, 28, 0.5) 55%, #1a0f08)', border: `1.5px solid ${COLORS.cream}`, color: COLORS.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MapPinIcon size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.name}{v.has_deal ? ' ⚡' : ''}
                    </div>
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: COLORS.textMuted, marginTop: 2 }}>
                      {v.suburb} · <VenueDistance lat={v.lat} lng={v.lng} />
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: COLORS.orange, fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 13 }}>
                    {displayScore(v) ? <><StarIcon size={12} filled /> {displayScore(v)}</> : 'NEW'}
                  </span>
                  <ChevronRightIcon size={16} style={{ color: COLORS.textMuted }} />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="brand-rule" style={{ marginTop: 28 }} />
    </>
  );
}
