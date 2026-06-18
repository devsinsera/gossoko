import { Skeleton, RankingRowSkeleton } from '@/components/Skeleton';

export default function RankingsLoading() {
  return (
    <>
      <header className="top-bar">
        <div>
          <Skeleton width={140} height={26} />
          <div style={{ marginTop: 6 }}>
            <Skeleton width={180} height={11} />
          </div>
        </div>
      </header>

      <div className="h-scroll" style={{ marginTop: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={100} height={34} radius={999} />
        ))}
      </div>

      <section className="section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 8, alignItems: 'end' }}>
          <Skeleton height={124} radius={10} />
          <Skeleton height={156} radius={10} />
          <Skeleton height={124} radius={10} />
        </div>
      </section>

      <section className="section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <RankingRowSkeleton key={i} rank={i + 1} />
          ))}
        </div>
      </section>
    </>
  );
}
