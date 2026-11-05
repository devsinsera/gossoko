import { Skeleton } from '@/components/Skeleton';

export default function VenueDetailLoading() {
  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 0 8px',
      }}>
        <Skeleton width={72} height={36} radius={8} />
        <Skeleton width={84} height={36} radius={8} />
      </div>

      <Skeleton width="100%" height={260} radius={14} />

      <section className="section">
        <Skeleton width="100%" height={64} radius={10} />
      </section>

      <section className="section">
        <Skeleton width={80} height={11} />
        <div style={{ marginTop: 10 }}>
          <Skeleton width="100%" height={120} radius={10} />
        </div>
      </section>

      <section className="section">
        <Skeleton width={140} height={11} />
        <div style={{ marginTop: 10 }}>
          <Skeleton width="100%" height={220} radius={10} />
        </div>
      </section>

      <section className="section">
        <Skeleton width={100} height={11} />
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={120} radius={10} />
          ))}
        </div>
      </section>
    </>
  );
}
