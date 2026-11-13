import { Link } from '@/lib/nav';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useLoad } from '@/lib/useLoad';
import { useQuery } from '@/lib/nav';
import { ActionForm } from '@/components/ActionForm';
import NotFound from '../../not-found';
import { getVenueBySlug } from '@/lib/queries/venues';
import { getReviewByUserAndVenue } from '@/lib/queries/reviews';
import { RATING_LABELS, RATING_ORDER } from '@/lib/types';
import { COLORS, RADIUS, SPACE, BRAND_RIBBON, BRAND_GRADIENT } from '@/lib/theme';
import { submitReview } from './actions';

const AXIS_TO_COL: Record<string, string> = {
  coffee_strength: 'coffee_strength_rating',
  feed_size: 'feed_size_rating',
  bang_for_buck: 'bang_for_buck_rating',
  speed: 'speed_rating',
  ute_parking: 'ute_parking_rating',
  early_open: 'early_open_rating',
  service: 'service_rating',
};

export default function NewReviewPage() {
  const { venue: slug } = useQuery('venue');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { data, loading } = useLoad(async () => {
    if (!slug || !user) return null;
    const venue = await getVenueBySlug(slug);
    if (!venue) return null;
    return { venue, existing: await getReviewByUserAndVenue(user.id, venue.id) };
  }, [slug, user?.id]);

  if (!slug) return <NotFound />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(`/review/new?venue=${slug}`)}`} replace />;
  if (loading) return <p style={{ padding: 16, color: COLORS.textSecondary }}>Loading…</p>;
  if (!data) return <NotFound />;
  const { venue, existing } = data;
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
        <div aria-hidden style={{ height: 6, background: BRAND_RIBBON }} />
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
              border: `1px solid ${COLORS.green}`,
              borderRadius: RADIUS.md,
              color: COLORS.text, fontSize: 13,
            }}>
              Editing your review from {new Date(existing.posted_at).toLocaleDateString()}.
            </div>
          )}

          <ActionForm
            action={submitReview}
            onDone={(r) => {
              const res = r as Awaited<ReturnType<typeof submitReview>>;
              if (res.ok) navigate(`/venue/${venue.slug}?review=${res.photoError ? 'photofail' : res.pending ? 'pending' : res.updated ? 'updated' : 'submitted'}`);
              else if (res.unauthenticated) navigate(`/login?next=${encodeURIComponent(`/review/new?venue=${venue.slug}`)}`);
              else setError(res.error);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}
          >
            <input type="hidden" name="venue_id" value={venue.id} />
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

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: COLORS.textSecondary }}>
              Photos (optional, up to 3)
              <input type="file" name="photos" accept="image/*" multiple style={{ color: COLORS.text }} />
              <span style={{ fontSize: 12 }}>A moderator checks photos before they show.</span>
            </label>

            <button
              type="submit"
              style={{
                background: BRAND_GRADIENT,
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
          </ActionForm>
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
