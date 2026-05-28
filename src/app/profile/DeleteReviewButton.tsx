'use client';

import { useTransition } from 'react';
import { COLORS } from '@/lib/theme';
import { deleteReview } from './actions';

export function DeleteReviewButton({
  reviewId,
  venueSlug,
  reviewTitle,
}: {
  reviewId: string;
  venueSlug: string;
  reviewTitle: string;
}) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    const confirmed = confirm(
      `Delete your review "${reviewTitle}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await deleteReview(reviewId, venueSlug);
      if (!res.ok) {
        alert(`Could not delete review: ${res.error}`);
      }
      // On success, revalidatePath in the action causes the server component
      // to re-render, removing this row automatically.
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label="Delete review"
      style={{
        background: 'transparent',
        border: `1px solid ${COLORS.red}`,
        borderRadius: 6,
        color: COLORS.red,
        padding: '5px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontWeight: 700,
        cursor: pending ? 'wait' : 'pointer',
        opacity: pending ? 0.5 : 1,
        transition: 'opacity 80ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {pending ? '…' : 'Delete'}
    </button>
  );
}
