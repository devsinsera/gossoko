import { Skeleton, VenueCardSkeleton, VenueListSkeleton } from '@/components/Skeleton';

export default function FeedLoading() {
  return (
    <>
      <header className="top-bar">
        <div>
          <Skeleton width={160} height={26} />
          <div style={{ marginTop: 6 }}>
            <Skeleton width={220} height={12} />
          </div>
        </div>
        <Skeleton width={96} height={26} radius={999} />
      </header>

      <div className="h-scroll" style={{ marginTop: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width={92} height={34} radius={999} />
        ))}
      </div>

      <section className="section">
        <Skeleton width="100%" height={200} radius={14} />
      </section>

      <section className="section">
        <div className="section-title"><Skeleton width={100} height={11} /></div>
        <div className="h-scroll">
          {Array.from({ length: 3 }).map((_, i) => (
            <VenueCardSkeleton key={i} compact />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title"><Skeleton width={140} height={11} /></div>
        <VenueListSkeleton count={3} />
      </section>
    </>
  );
}
