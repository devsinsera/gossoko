
import { useState } from 'react';

import type { FilterId } from '@/lib/filters';
export type { FilterId };

export interface FilterChip {
  id: FilterId;
  label: string;
  hint?: string;
}

export const DEFAULT_CHIPS: FilterChip[] = [
  { id: 'all',          label: 'All' },
  { id: 'open_now',     label: 'Open Now' },
  { id: 'deals',        label: 'Deals' },
  { id: 'early_open',   label: '≤ 5am' },
  { id: 'ute_friendly', label: 'Ute Parking' },
  { id: 'cheap_eats',   label: 'Cheap Eats' },
  { id: 'top_rated',    label: 'Top Rated' },
  { id: 'gossoko_van',  label: 'Coffee Vans' },
  { id: 'cafe',         label: 'Cafés' },
  { id: 'food_truck',   label: 'Food Trucks' },
  { id: 'bakery',       label: 'Bakeries' },
  { id: 'servo',        label: 'Servos' },
];

export function FilterChips({
  chips = DEFAULT_CHIPS,
  defaultSelected = 'all',
  onChange,
}: {
  chips?: FilterChip[];
  defaultSelected?: FilterId;
  onChange?: (id: FilterId) => void;
}) {
  const [selected, setSelected] = useState<FilterId>(defaultSelected);

  return (
    <div className="h-scroll chip-row" role="tablist" aria-label="Filter venues">
      {chips.map((chip) => {
        const active = selected === chip.id;
        return (
          <button
            key={chip.id}
            role="tab"
            aria-selected={active}
            onClick={() => {
              setSelected(chip.id);
              onChange?.(chip.id);
            }}
            className="chip"
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
