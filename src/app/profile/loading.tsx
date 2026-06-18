import { Skeleton } from '@/components/Skeleton';

export default function ProfileLoading() {
  return (
    <>
      <header className="top-bar">
        <div>
          <Skeleton width={110} height={26} />
          <div style={{ marginTop: 6 }}>
            <Skeleton width={160} height={11} />
          </div>
        </div>
      </header>

      <section className="section">
        <Skeleton width="100%" height={200} radius={14} />
      </section>

      <section className="section">
        <div style={{ display: 'flex', gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} width={120} height={32} radius={999} />
          ))}
        </div>
      </section>

      <section className="section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Skeleton height={80} radius={10} />
          <Skeleton height={80} radius={10} />
        </div>
      </section>

      <section className="section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={60} radius={10} />
          ))}
        </div>
      </section>
    </>
  );
}
