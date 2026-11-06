import { useLoad } from '@/lib/useLoad';
import { getVenuePhotos } from '@/lib/photos';
import { COLORS } from '@/lib/theme';

/** Approved photos only; renders nothing when there are none. */
export function VenuePhotos({ venueId, name }: { venueId: string; name: string }) {
  const { data } = useLoad(() => getVenuePhotos(venueId), [venueId]);
  if (!data?.length) return null;
  return (
    <section className="section">
      <div className="section-title"><h2>Photos</h2></div>
      <div className="h-scroll" style={{ gap: 8 }}>
        {data.map((p) => (
          <img key={p.id} src={p.url} alt={`${name}, photo from the crew`} loading="lazy" decoding="async"
            style={{ flex: '0 0 auto', height: 150, width: 'auto', maxWidth: 260, objectFit: 'cover', borderRadius: 10, border: `1px solid ${COLORS.border}` }} />
        ))}
      </div>
    </section>
  );
}
