import type { Ratings } from '@/lib/seed/types';
import { RATING_LABELS, RATING_ORDER } from '@/lib/seed/types';
import { COLORS } from '@/lib/theme';

// Horizontal-bar rating breakdown — one bar per axis.
// Numbers in mono so they read as instruments, not opinions.
export function RatingBars({ ratings }: { ratings: Ratings }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {RATING_ORDER.map((axis) => {
        const v = ratings[axis];
        const pct = (v / 5) * 100;
        return (
          <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              flex: '0 0 110px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: COLORS.textSecondary,
            }}>
              {RATING_LABELS[axis]}
            </span>
            <div style={{
              flex: 1,
              height: 8,
              background: COLORS.surfaceAlt,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              overflow: 'hidden',
              position: 'relative',
            }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: v >= 4
                    ? COLORS.orange
                    : v >= 3 ? COLORS.orangeBright : COLORS.textMuted,
                }}
              />
            </div>
            <span style={{
              flex: '0 0 28px',
              textAlign: 'right',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: COLORS.text,
              fontWeight: 700,
            }}>
              {v.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Compact dot row — used in headers / list contexts.
export function RatingDots({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden
          style={{
            width: size, height: size,
            borderRadius: '50%',
            background: n <= Math.round(value) ? COLORS.orange : COLORS.surfaceAlt,
            border: `1px solid ${COLORS.border}`,
          }}
        />
      ))}
    </span>
  );
}
