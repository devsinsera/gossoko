import { useState } from 'react';
import { COLORS, RADIUS } from '@/lib/theme';
import { blockUser } from '@/lib/blocks';

/** Hides one person's reviews and comments from you. Private; they are not told. */
export function BlockButton({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const [state, setState] = useState<'idle' | 'working' | 'blocked' | 'error'>('idle');
  if (isSelf || state === 'blocked') {
    return state === 'blocked' ? (
      <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Blocked — their posts are hidden</span>
    ) : null;
  }
  return (
    <button
      type="button"
      disabled={state === 'working'}
      onClick={async () => {
        if (!window.confirm('Block this person? Their reviews and comments will be hidden from you.')) return;
        setState('working');
        const outcome = await blockUser(userId);
        setState(outcome === 'blocked' ? 'blocked' : 'error');
      }}
      style={{
        background: 'transparent',
        border: `1px solid ${COLORS.border}`,
        color: COLORS.textSecondary,
        borderRadius: RADIUS.md,
        padding: '6px 10px',
        fontSize: 11,
        fontFamily: 'var(--font-label)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {state === 'error' ? 'Try again' : 'Block'}
    </button>
  );
}
