import { useEffect } from 'react';
import { useLoad } from '@/lib/useLoad';
import { getPromotedVenueIds, trackVenueEvent } from '@/lib/queries/business';
import { COLORS } from '@/lib/theme';
import { VenueCard } from './VenueCard';
import type { Venue } from '@/lib/types';

/** Up to two paid placements at the top of a list. Always labelled; never mixed into Rankings. */
export function PromotedSpots({ venues, limit = 2 }: { venues: Venue[]; limit?: number }) {
  const { data: ids } = useLoad(getPromotedVenueIds, []);
  const byId = new Map(venues.map((v) => [v.id, v]));
  const shown = (ids ?? []).map((id) => byId.get(id)).filter((v): v is Venue => v != null).slice(0, limit);
  const key = shown.map((v) => v.id).join(',');
  useEffect(() => { for (const v of shown) trackVenueEvent(v.id, 'promo_view'); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (shown.length === 0) return null;
  return (
    <section className="section">
      <div className="section-title"><h2>Promoted</h2></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shown.map((v) => (
          <div key={v.id} onClickCapture={() => trackVenueEvent(v.id, 'promo_click')} style={{ position: 'relative' }}>
            <VenueCard venue={v} />
            <span style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: COLORS.textSecondary, background: 'rgba(10,9,8,0.8)', border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: '3px 6px' }}>
              Promoted
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
