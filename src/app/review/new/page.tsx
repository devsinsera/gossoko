import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getVenueBySlug } from '@/lib/queries/venues';
import { getReviewByUserAndVenue } from '@/lib/queries/reviews';
import { getCurrentUser } from '@/lib/auth/permissions';
import { RATING_LABELS, RATING_ORDER } from '@/lib/seed/types';
import { COLORS, RADIUS, SPACE, HAZARD_STRIPES } from '@/lib/theme';
import { submitReview } from './actions';

export const dynamic = 'force-dynamic';

const AXIS_TO_COL: Record<string, string> = {
  coffee_strength: 'coffee_strength_rating',
  feed_size: 'feed_size_rating',
  bang_for_buck: 'bang_for_buck_rating',
  speed: 'speed_rating',
  ute_parking: 'ute_parking_rating',
  early_open: 'early_open_rating',
  service: 'service_rating',
};

export default async function NewReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string; error?: string }>;
}) {
  const { venue: slug, error } = await searchParams;
  if (!slug) notFound();

  const venue = await getVenueBySlug(slug);
  if (!venue) notFound();

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/review/new?venue=${slug}`)}`);
  }

  const existing = await getReviewByUserAndVenue(user.id, venue.id);
  const editMode = !!existing;

  return (
    <div style={{ paddingBottom: 80 }}>
      <header style={{ padding: '14px 0 8px', display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
        <Link
          href={`/venue/${venue.slug}`}
          style={{
            display: 'inline-flex', gap: 4, alignItems: 'center',
            color: COLORS.textSecondary, textDecoration: 'none', fontSize: 13,
          }}
        >
          ← Back to {venue.name}
        </Link>
      </header>

      <section style={{
        background: COLORS.surface,
        border: `1.5px solid ${COLORS.border}`,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        marginTop: SPACE.sm,
      }}>
        <div aria-hidden style={{ height: 6, background: HAZARD_STRIPES }} />
        <div style={{ padding: SPACE.lg }}>
          <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 0.5 }}>
            {editMode ? 'EDIT YOUR REVIEW' : 'WRITE A REVIEW'}
          </h1>
          <p style={{ margin: `${SPACE.xs}px 0 ${SPACE.lg}px`, color: COLORS.textSecondary, fontSize: 13 }}>
            Rate {venue.name} on the seven axes. Be honest — your crew is reading.
          </p>

          {error && (
            <div style={{
              marginBottom: SPACE.md,
              padding: '10px 12px',
              background: 'rgba(230,57,70,0.15)',
              border: `1px solid ${COLORS.red}`,
              borderRadius: RADIUS.md,
              color: COLORS.text, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {editMode && existing && (
            <div style={{
              marginBottom: SPACE.md,
              padding: '10px 12px',
              background: 'rgba(168,224,0,0.10)',
              border: `1px solid ${COLORS.hiVisGreen}`,
              borderRadius: RADIUS.md,
              color: COLORS.text, fontSize: 13,
            }}>
              Editing your review from {new Date(existing.posted_at).toLocaleDateString()}.
            </div>
          )}

          <form action={submitReview} style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            <input type="hidden" name="venue_id" value={venue.id} />
            <input type="hidden" name="venue_slug" value={venue.slug} />
            {existing && <input type="hidden" name="review_id" value={existing.id} />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
              {RATING_ORDER.map((axis) => (
                <AxisField
                  key={axis}
                  axis={axis}
                  label={RATING_LABELS[axis]}
                  colName={AXIS_TO_COL[axis]}
                  defaultValue={existing?.ratings[axis]}
                />
              ))}
            </div>

            <Field
              label="Title"
              name="title"
              placeholder="One line that sums it up"
              required
              minLength={3}
              maxLength={120}
              defaultValue={existing?.title}
            />
            <Field
              label="Body"
              name="body"
              placeholder="What was the experience? What stood out?"
              required
              minLength={10}
              maxLength={2000}
              textarea
              defaultValue={existing?.body}
            />

            <button
              type="submit"
              style={{
                background: COLORS.orange,
                color: '#0a0908',
                border: 'none',
                borderRadius: RADIUS.md,
                padding: 12,
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: 0.5,
                cursor: 'pointer',
                marginTop: SPACE.sm,
              }}
            >
              {editMode ? 'Update review' : 'Post review'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function AxisField({ axis, label, colName, defaultValue }: { axis: string; label: string; colName: string; defaultValue?: number }) {
  return (
    <div>
      <div style={{
        fontSize: 11, color: COLORS.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
      }}>
        {label}
      </div>
      <div role="radiogroup" aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="review-axis-btn"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 44,
              background: COLORS.bgElev,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.md,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 16,
              color: COLORS.text,
              position: 'relative',
              userSelect: 'none',
            }}
          >
            <input
              type="radio"
              name={colName}
              value={n}
              required
              defaultChecked={defaultValue === n}
              data-axis={axis}
              style={{
                position: 'absolute', opacity: 0, pointerEvents: 'none',
              }}
            />
            <span>{n}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Field({
  label, name, placeholder, required, minLength, maxLength, textarea, defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  textarea?: boolean;
  defaultValue?: string;
}) {
  const baseStyle: React.CSSProperties = {
    background: COLORS.bgElev,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    padding: '10px 12px',
    fontSize: 15,
    outline: 'none',
    fontFamily: 'inherit',
  };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 11, color: COLORS.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        {label}
      </span>
      {textarea ? (
        <textarea
          name={name}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          rows={5}
          defaultValue={defaultValue}
          style={{ ...baseStyle, resize: 'vertical', minHeight: 110 }}
        />
      ) : (
        <input
          type="text"
          name={name}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          defaultValue={defaultValue}
          style={baseStyle}
        />
      )}
    </label>
  );
}
