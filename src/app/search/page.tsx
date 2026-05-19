'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SearchBar } from '@/components/SearchBar';
import { VENUES } from '@/lib/seed/venues';
import { COLORS } from '@/lib/theme';
import { ChevronRightIcon, MapPinIcon, StarIcon, SearchIcon } from '@/components/icons';

const RECENT = ['the smoko stop', 'bowen hills', 'open before 5am', 'cheap lunch', 'ute parking'];
const SUGGESTED_SUBURBS = ['Bowen Hills', 'Newstead', 'Eagle Farm', 'Hamilton', 'Stafford', 'Geebung', 'Salisbury'];

export default function SearchPage() {
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const needle = q.trim().toLowerCase();
    return VENUES.filter((v) =>
      v.name.toLowerCase().includes(needle) ||
      v.suburb.toLowerCase().includes(needle) ||
      v.tagline.toLowerCase().includes(needle) ||
      v.tags.some((t) => t.toLowerCase().includes(needle)),
    ).slice(0, 12);
  }, [q]);

  return (
    <>
      <header className="top-bar">
        <div>
          <h1>SEARCH</h1>
          <p className="top-bar__sub">Venues · suburbs · tags</p>
        </div>
      </header>

      <SearchBar autoFocus onChange={setQ} placeholder="Search venues, suburbs, tags…" />

      {!q.trim() && (
        <>
          <section className="section">
            <div className="section-title"><h2>Recent</h2></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {RECENT.map((r) => (
                <button
                  key={r}
                  onClick={() => setQ(r)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    color: COLORS.text,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <SearchIcon size={14} style={{ color: COLORS.textMuted }} />
                  <span style={{ fontSize: 14 }}>{r}</span>
                  <ChevronRightIcon size={14} style={{ color: COLORS.textMuted }} />
                </button>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-title"><h2>Brisbane Suburbs</h2></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SUGGESTED_SUBURBS.map((s) => (
                <button
                  key={s}
                  onClick={() => setQ(s)}
                  style={{
                    padding: '8px 12px',
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 999,
                    color: COLORS.text,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  <MapPinIcon size={12} style={{ marginRight: 6, color: COLORS.orange }} />
                  {s}
                </button>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-title"><h2>Popular Searches</h2></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['Open Now', 'Coffee Vans', 'Ute Parking', 'Big Brekkie', 'Under $10', 'Hidden Gems'].map((t) => (
                <button
                  key={t}
                  onClick={() => setQ(t.toLowerCase())}
                  style={{
                    padding: '8px 12px',
                    background: COLORS.orangeFaint,
                    border: `1px solid ${COLORS.orange}`,
                    borderRadius: 999,
                    color: COLORS.orange,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11.5,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {q.trim() && (
        <section className="section">
          <div className="section-title">
            <h2>
              {results.length} result{results.length === 1 ? '' : 's'} for "{q}"
            </h2>
          </div>

          {results.length === 0 ? (
            <div style={{
              padding: '28px 18px',
              background: COLORS.surface,
              border: `1px dashed ${COLORS.border}`,
              borderRadius: 12,
              textAlign: 'center',
              color: COLORS.textMuted,
            }}>
              <SearchIcon size={28} style={{ color: COLORS.textMuted }} />
              <p style={{ margin: '10px 0 0', fontSize: 14, color: COLORS.textSecondary }}>
                No venues match yet — try a suburb or "open now".
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((v) => (
                <Link
                  key={v.id}
                  href={`/venue/${v.slug}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '12px 14px',
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                  }}
                >
                  <div style={{
                    width: 40, height: 40,
                    borderRadius: 8,
                    background: `linear-gradient(135deg, ${v.hero_color}, #0a0908)`,
                    border: `1px solid ${v.hero_accent}`,
                    color: v.hero_accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MapPinIcon size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 14.5,
                      fontWeight: 700,
                      color: COLORS.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {v.name}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: COLORS.textMuted,
                      marginTop: 2,
                    }}>
                      {v.suburb} · {v.distance_km}km
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: COLORS.orange,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: 13,
                  }}>
                    <StarIcon size={12} filled /> {v.overall.toFixed(1)}
                  </span>
                  <ChevronRightIcon size={16} style={{ color: COLORS.textMuted }} />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="hazard-strip" style={{ marginTop: 28 }} />
    </>
  );
}
