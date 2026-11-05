import { Link } from '@/lib/nav';
import { getAllVenues } from '@/lib/queries/venues';
import { useLoad } from '@/lib/useLoad';
import { useQuery } from '@/lib/nav';
import RankingsLoading from './loading';
import { MIN_REVIEWS_TO_RANK, rankVenues, reviewCountLabel } from '@/lib/ranking';
import { COLORS } from '@/lib/theme';
import { TrophyIcon, FlameIcon, StarIcon, ChevronRightIcon } from '@/components/icons';

type RankingMode = 'overall' | 'speed' | 'feed_size' | 'bang_for_buck' | 'early_open';

const MODES: { id: RankingMode; label: string; hint: string }[] = [
  { id: 'overall',       label: 'Overall',       hint: 'Top-rated across all axes' },
  { id: 'speed',         label: 'Fastest',       hint: 'In and out under 5 min' },
  { id: 'feed_size',     label: 'Biggest Feed',  hint: 'You won\'t eat for hours' },
  { id: 'bang_for_buck', label: 'Best Value',    hint: 'Apprentice-budget friendly' },
  { id: 'early_open',    label: 'Earliest',      hint: 'Open before 5am' },
];

export default function RankingsPage() {
  const { mode: modeParam } = useQuery('mode');
  const { data: venues, loading } = useLoad(getAllVenues, []);
  if (loading && !venues) return <RankingsLoading />;
  const mode: RankingMode = (MODES.find((m) => m.id === modeParam)?.id ?? 'overall');
  const active = MODES.find((m) => m.id === mode)!;

  const ranked = rankVenues(venues ?? [], mode);

  return (
    <>
      <header className="top-bar">
        <div>
          <h1 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <TrophyIcon size={22} /> RANKINGS
          </h1>
          <p className="top-bar__sub">Brisbane · {active.hint}</p>
        </div>
      </header>

      {/* Mode tabs */}
      <div className="h-scroll" role="tablist" style={{ marginTop: 4 }}>
        {MODES.map((m) => {
          const a = m.id === mode;
          return (
            <Link
              key={m.id}
              href={`/rankings?mode=${m.id}`}
              role="tab"
              aria-selected={a}
              style={{
                flex: '0 0 auto',
                padding: '9px 14px',
                borderRadius: 999,
                border: `1.5px solid ${a ? COLORS.orange : COLORS.border}`,
                background: a ? COLORS.orange : COLORS.surface,
                color: a ? '#0a0908' : COLORS.text,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {m.label}
            </Link>
          );
        })}
      </div>

      {ranked.length === 0 && (
        <section className="section">
          <p style={{ color: COLORS.textSecondary, lineHeight: 1.5 }}>
            Nothing ranked yet. A venue joins the leaderboard once it has {MIN_REVIEWS_TO_RANK} reviews from the crew —
            rate the places you stop at and they&apos;ll show up here.
          </p>
        </section>
      )}

      {/* Podium — top 3 */}
      {ranked.length > 0 && (<>
      <section className="section">
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr 1fr',
          gap: 8,
          alignItems: 'end',
        }}>
          {[1, 0, 2].map((idx, displayPos) => {
            const v = ranked[idx];
            if (!v) return <div key={idx} />;
            const value = mode === 'overall' ? v.overall.toFixed(1) : v.ratings[mode].toFixed(1);
            const place = idx + 1;
            const tallH = displayPos === 1 ? 156 : 124;
            const medalColor = place === 1 ? COLORS.orange : place === 2 ? '#cfcfcf' : '#c87a3a';
            return (
              <Link
                key={v.id}
                href={`/venue/${v.slug}`}
                style={{
                  display: 'block',
                  background: `linear-gradient(180deg, ${v.hero_color}, #0a0908)`,
                  border: `1.5px solid ${place === 1 ? COLORS.orange : COLORS.border}`,
                  borderRadius: 10,
                  padding: 10,
                  height: tallH,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 26, height: 26, borderRadius: '50%',
                  background: medalColor,
                  color: '#0a0908',
                  fontWeight: 800,
                  fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {place}
                </div>
                <div style={{
                  position: 'absolute', bottom: 10, left: 10, right: 10,
                }}>
                  <div style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: COLORS.text,
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {v.name}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    color: COLORS.orange,
                    fontSize: 16,
                    fontWeight: 700,
                    marginTop: 4,
                  }}>
                    ★ {value}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Full ranking list */}
      <section className="section">
        <div className="section-title">
          <h2>Full Leaderboard</h2>
          <span className="mono-chip">{ranked.length} venues</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranked.map((v, i) => {
            const place = i + 1;
            const value = mode === 'overall' ? v.overall.toFixed(1) : v.ratings[mode].toFixed(1);
            const isHot = place <= 3;
            return (
              <Link
                key={v.id}
                href={`/venue/${v.slug}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr auto auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '12px 12px',
                  background: COLORS.surface,
                  border: `1px solid ${isHot ? COLORS.orange : COLORS.border}`,
                  borderRadius: 10,
                  position: 'relative',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: isHot ? COLORS.orange : COLORS.textMuted,
                  letterSpacing: '0.02em',
                }}>
                  {String(place).padStart(2, '0')}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    color: COLORS.text,
                    fontWeight: 700,
                    fontSize: 14.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {v.name}
                    {v.trending && (
                      <FlameIcon size={13} style={{ color: COLORS.orangeHot, marginLeft: 6, verticalAlign: 'middle' }} />
                    )}
                  </div>
                  <div style={{
                    color: COLORS.textSecondary,
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    marginTop: 2,
                  }}>
                    {v.suburb} · {reviewCountLabel(v.review_count)}
                  </div>
                </div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  background: COLORS.orangeFaint,
                  border: `1px solid ${COLORS.orange}`,
                  borderRadius: 6,
                  color: COLORS.orange,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: 13,
                }}>
                  <StarIcon size={12} filled />
                  {value}
                </span>
                <ChevronRightIcon size={16} style={{ color: COLORS.textMuted }} />
              </Link>
            );
          })}
        </div>
      </section>
      </>)}

      <div className="hazard-strip" style={{ marginTop: 28 }} />
    </>
  );
}
