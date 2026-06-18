'use client';

import { useState } from 'react';
import { SearchIcon, XIcon } from './icons';
import { COLORS } from '@/lib/theme';

export function SearchBar({
  placeholder = 'Search venues, suburbs, or feeds…',
  autoFocus = false,
  onChange,
}: {
  placeholder?: string;
  autoFocus?: boolean;
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = useState('');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 14px',
        background: COLORS.surface,
        border: `1.5px solid ${COLORS.border}`,
        borderRadius: 10,
        minHeight: 48,
      }}
    >
      <span style={{ color: COLORS.textSecondary, display: 'inline-flex' }}>
        <SearchIcon size={18} />
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          setValue(e.target.value);
          onChange?.(e.target.value);
        }}
        style={{
          flex: 1,
          background: 'transparent',
          color: COLORS.text,
          border: 'none',
          outline: 'none',
          fontSize: 15,
          fontFamily: 'var(--font-body)',
          minWidth: 0,
        }}
      />
      {value && (
        <button
          aria-label="Clear search"
          onClick={() => {
            setValue('');
            onChange?.('');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: COLORS.textSecondary,
            cursor: 'pointer',
            display: 'inline-flex',
            padding: 4,
          }}
        >
          <XIcon size={18} />
        </button>
      )}
    </div>
  );
}
