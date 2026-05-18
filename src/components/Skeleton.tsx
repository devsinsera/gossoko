import { COLORS } from '@/lib/theme';

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 6,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="skeleton"
      style={{
        display: 'inline-block',
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

export function VenueCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 12,
      overflow: 'hidden',
      minWidth: compact ? 220 : undefined,
      width: compact ? 220 : '100%',
    }}>
      <Skeleton width="100%" height={compact ? 100 : 140} radius={0} />
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Skeleton width="70%" height={16} />
            <div style={{ marginTop: 8 }}>
              <Skeleton width="55%" height={11} />
            </div>
          </div>
          <Skeleton width={52} height={28} radius={6} />
        </div>
        {!compact && (
          <div style={{ marginTop: 10 }}>
            <Skeleton width="92%" height={11} />
            <div style={{ marginTop: 6 }}>
              <Skeleton width="80%" height={11} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function VenueListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <VenueCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div style={{
      position: 'relative',
      height: 360,
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 12 }} />
      <div style={{
        position: 'absolute', inset: 0,
        background:
          `radial-gradient(circle at 30% 40%, ${COLORS.orangeFaint}, transparent 60%),
           radial-gradient(circle at 70% 60%, ${COLORS.orangeFaint}, transparent 50%)`,
      }} />
    </div>
  );
}

export function RankingRowSkeleton({ rank }: { rank: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 10,
    }}>
      <span style={{
        flex: '0 0 28px',
        fontFamily: 'var(--font-mono)',
        fontSize: 18,
        color: COLORS.textMuted,
      }}>
        {String(rank).padStart(2, '0')}
      </span>
      <div style={{ flex: 1 }}>
        <Skeleton width="60%" height={14} />
        <div style={{ marginTop: 6 }}>
          <Skeleton width="40%" height={10} />
        </div>
      </div>
      <Skeleton width={40} height={28} radius={6} />
    </div>
  );
}
