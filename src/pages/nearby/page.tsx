import { getAllVenues } from '@/lib/queries/venues';
import { useState } from 'react';
import { useLoad } from '@/lib/useLoad';
import { applyFilter, type FilterId } from '@/lib/filters';
import NearbyLoading from './loading';
import { VenueMap } from '@/components/VenueMap';
import { FilterChips } from '@/components/FilterChips';
import { NearbyList } from './NearbyList';
import { PromotedSpots } from '@/components/PromotedSpots';

export default function NearbyPage() {
  const { data, loading } = useLoad(getAllVenues, []);
  const [filter, setFilter] = useState<FilterId>('all');
  if (loading && !data) return <NearbyLoading />;
  const ALL = data ?? [];
  const VENUES = applyFilter(ALL, filter);
  return (
    <>
      <header className="top-bar">
        <div>
          <h1>NEARBY</h1>
          <p className="top-bar__sub">{VENUES.length} {VENUES.length === 1 ? 'venue' : 'venues'}{filter !== 'all' ? ' match' : ''}</p>
        </div>
      </header>

      <FilterChips onChange={setFilter} />

      {filter === 'all' && <PromotedSpots venues={ALL} />}

      {VENUES.length > 0 ? (
        <section className="section">
          <VenueMap venues={VENUES} />
        </section>
      ) : (
        <section className="section">
          <p style={{ color: '#a89e92', lineHeight: 1.5 }}>Nothing matches that filter right now — try another, or pick All.</p>
        </section>
      )}

      {/* Distance-dependent sections re-sort/filter by REAL distance once
          geolocation resolves; otherwise fall back to static ordering. */}
      <NearbyList venues={VENUES} />

      <div className="brand-rule" style={{ marginTop: 28 }} />
    </>
  );
}
