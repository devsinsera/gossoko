import { Skeleton, MapSkeleton, VenueCardSkeleton } from '@/components/Skeleton';

export default function NearbyLoading() {
  return (
    <>
      <header className="top-bar">
        <div>
          <Skeleton width={120} height={26} />
          <div style={{ marginTop: 6 }}>
            <Skeleton width={160} height={11} />
          </div>
        </div>
      </header>

      <div className="h-scroll" style={{ marginTop: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width={92} height={34} radius={999} />
        ))}
      </div>

      <section className="section">
        <MapSkeleton />
      </section>

      <section className="section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <VenueCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </>
  );
}
