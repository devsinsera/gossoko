import type { RatingAxis, Venue } from '@/lib/types';

/** A venue needs this many approved reviews before it is ranked. */
export const MIN_REVIEWS_TO_RANK = 3;
/** How many "average" reviews every venue is padded with when ranking. */
const PRIOR_WEIGHT = 5;

export type RankMode = 'overall' | RatingAxis;

function score(v: Venue, mode: RankMode): number {
  return mode === 'overall' ? v.overall : v.ratings[mode];
}

/**
 * Venues with enough reviews, best first. Scores are pulled toward the average
 * of all ranked venues (a Bayesian average), so one 5-star review can't beat
 * forty 4.6s. Ties go to the venue with more reviews.
 */
export function rankVenues(venues: Venue[], mode: RankMode = 'overall'): Venue[] {
  const eligible = venues.filter((v) => v.review_count >= MIN_REVIEWS_TO_RANK && score(v, mode) > 0);
  if (eligible.length === 0) return [];
  const totalReviews = eligible.reduce((n, v) => n + v.review_count, 0);
  const mean = eligible.reduce((s, v) => s + score(v, mode) * v.review_count, 0) / totalReviews;
  const fair = (v: Venue) => (score(v, mode) * v.review_count + mean * PRIOR_WEIGHT) / (v.review_count + PRIOR_WEIGHT);
  return [...eligible].sort((a, b) => fair(b) - fair(a) || b.review_count - a.review_count);
}

/** "4.3", or null when the venue has no reviews yet (show "New" instead of 0.0). */
export function displayScore(v: Pick<Venue, 'overall' | 'review_count'>): string | null {
  return v.review_count > 0 ? v.overall.toFixed(1) : null;
}

export function reviewCountLabel(n: number): string {
  return n === 0 ? 'No reviews yet' : n === 1 ? '1 review' : `${n} reviews`;
}
