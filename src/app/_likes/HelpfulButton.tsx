'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { COLORS } from '@/lib/theme';
import { toggleHelpful } from './actions';

export function HelpfulButton({
  reviewId,
  initialLiked,
  initialCount,
  venueSlug,
  isSignedIn,
}: {
  reviewId: string;
  initialLiked: boolean;
  initialCount: number;
  venueSlug: string;
  isSignedIn: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = () => {
    if (!isSignedIn) {
      router.push(`/login?next=${encodeURIComponent(`/venue/${venueSlug}`)}`);
      return;
    }
    // Optimistic toggle.
    const next = !liked;
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));

    startTransition(async () => {
      const res = await toggleHelpful(reviewId, liked, venueSlug);
      if (!res.ok) {
        // Roll back on failure.
        setLiked(liked);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={liked}
      style={{
        background: liked ? COLORS.hiVisGreen : 'transparent',
        border: `1px solid ${liked ? COLORS.hiVisGreen : COLORS.border}`,
        borderRadius: 6,
        color: liked ? '#0a0908' : COLORS.text,
        padding: '6px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        cursor: pending ? 'wait' : 'pointer',
        fontWeight: 700,
        opacity: pending ? 0.7 : 1,
        transition: 'background 80ms ease, color 80ms ease',
      }}
    >
      {liked ? '✓ Helpful' : 'Helpful'}
      {count > 0 && <span style={{ marginLeft: 6, opacity: 0.8 }}>· {count}</span>}
    </button>
  );
}
