import { getAllVenues } from '@/lib/queries/venues';
import { useLoad } from '@/lib/useLoad';
import NearbyLoading from './loading';
import { MapShell } from '@/components/MapShell';
import { FilterChips } from '@/components/FilterChips';
import { NearbyList } from './NearbyList';

export default function NearbyPage() {
  const { data, loading } = useLoad(getAllVenues, []);
  if (loading && !data) return <NearbyLoading />;
  const VENUES = data ?? [];
  return (
    <>
      <header className="top-bar">
        <div>
          <h1>NEARBY</h1>
          <p className="top-bar__sub">{VENUES.length} venues · within 40km</p>
        </div>
      </header>

      <FilterChips defaultSelected="open_now" />

      <section className="section">
        <MapShell venues={VENUES} />
      </section>

      {/* Distance-dependent sections re-sort/filter by REAL distance once
          geolocation resolves; otherwise fall back to static ordering. */}
      <NearbyList venues={VENUES} />

      <div className="hazard-strip" style={{ marginTop: 28 }} />
    </>
  );
}
