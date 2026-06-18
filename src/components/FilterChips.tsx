'use client';

import { useState } from 'react';
import { COLORS } from '@/lib/theme';

export type FilterId =
  | 'all' | 'open_now' | 'top_rated' | 'early_open' | 'ute_friendly' | 'cheap_eats'
  | 'gossoko_van' | 'cafe' | 'food_truck' | 'bakery' | 'servo' | 'snack_bar';

export interface FilterChip {
  id: FilterId;
  label: string;
  hint?: string;
}

export const DEFAULT_CHIPS: FilterChip[] = [
  { id: 'all',          label: 'All' },
  { id: 'open_now',     label: 'Open Now' },
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
    <div className="h-scroll" role="tablist" aria-label="Filter venues">
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
            style={{
              flex: '0 0 auto',
              padding: '9px 14px',
              borderRadius: 999,
              border: `1.5px solid ${active ? COLORS.orange : COLORS.border}`,
              background: active ? COLORS.orange : COLORS.surface,
              color: active ? '#0a0908' : COLORS.text,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: 36,
              transition: 'all 120ms ease',
            }}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
