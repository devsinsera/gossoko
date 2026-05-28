'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { COLORS, RADIUS, SPACE } from '@/lib/theme';
import { ReportButton } from '../_report/ReportButton';
import { addComment } from './actions';
import type { ReviewComment } from '@/lib/queries/comments';

const MAX_COMMENT_LENGTH = 1000;

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return iso.slice(0, 10);
}

export function CommentsSection({
  reviewId,
  venueSlug,
  initialComments,
  isSignedIn,
}: {
  reviewId: string;
  venueSlug: string;
  initialComments: ReviewComment[];
  isSignedIn: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const comments = initialComments;
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const count = comments.length;

  const handleSubmit = () => {
    if (!isSignedIn) {
      router.push(`/login?next=${encodeURIComponent(`/venue/${venueSlug}`)}`);
      return;
    }
    const trimmed = body.trim();
    if (!trimmed) {
      setError('Comment cannot be empty.');
      return;
    }
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setError(`Must be ${MAX_COMMENT_LENGTH} characters or fewer.`);
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await addComment(reviewId, venueSlug, trimmed);
      if (res.ok) {
        setBody('');
        // The page will revalidate via revalidatePath; the server component
        // will re-render with the new comment. For a snappy feel, we don't
        // do optimistic insertion — the server is the source of truth.
      } else {
        setError(res.error === 'unauthenticated'
          ? 'Sign in to comment.'
          : res.error);
      }
    });
  };

  return (
    <div style={{
      borderTop: `1px dashed ${COLORS.border}`,
      marginTop: SPACE.sm,
      paddingTop: SPACE.sm,
    }}>
      {/* Toggle row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: COLORS.textMuted,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          transition: 'transform 150ms ease',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>
          ▶
        </span>
        {count === 0 ? 'Add a comment' : `${count} comment${count === 1 ? '' : 's'}`}
      </button>

      {expanded && (
        <div style={{ marginTop: SPACE.sm, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          {/* Existing comments */}
          {comments.map((c) => (
            <div
              key={c.id}
              style={{
                background: COLORS.surfaceAlt,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.md,
                padding: '10px 12px',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
              }}>
                {/* Avatar */}
                <span style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: COLORS.surfaceHi,
                  color: COLORS.orange,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 9,
                  flexShrink: 0,
                }}>
                  {c.user.initials}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.text }}>
                    @{c.user.username}
                  </span>
                  <span style={{
                    marginLeft: 6,
                    fontSize: 10,
                    color: COLORS.textMuted,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}>
                    {c.user.trade} · {relativeDate(c.posted_at)}
                  </span>
                  {c.moderation_status !== 'approved' && (
                    <span style={{
                      marginLeft: 8,
                      fontSize: 9.5,
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: COLORS.hiVisYellow,
                      border: `1px solid ${COLORS.hiVisYellow}`,
                      borderRadius: RADIUS.sm,
                      padding: '1px 5px',
                    }}>
                      Pending review
                    </span>
                  )}
                </div>
                <ReportButton
                  reportableType="comment"
                  reportableId={c.id}
                  back={`/venue/${venueSlug}`}
                />
              </div>
              <p style={{
                margin: 0,
                color: COLORS.textSecondary,
                fontSize: 13,
                lineHeight: 1.55,
                wordBreak: 'break-word',
              }}>
                {c.body}
              </p>
            </div>
          ))}

          {/* Add-a-comment form */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.xs,
          }}>
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                if (error) setError(null);
              }}
              rows={3}
              placeholder={isSignedIn ? 'Add a comment…' : 'Sign in to comment'}
              disabled={pending}
              maxLength={MAX_COMMENT_LENGTH}
              style={{
                background: COLORS.bgElev,
                color: COLORS.text,
                border: `1px solid ${error ? COLORS.red : COLORS.border}`,
                borderRadius: RADIUS.md,
                padding: '8px 10px',
                fontSize: 13,
                resize: 'vertical',
                minHeight: 64,
                fontFamily: 'inherit',
                opacity: pending ? 0.7 : 1,
              }}
            />
            {error && (
              <div style={{
                fontSize: 11.5,
                color: COLORS.red,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.04em',
              }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SPACE.sm }}>
              <span style={{
                fontSize: 10,
                color: body.length > MAX_COMMENT_LENGTH ? COLORS.red : COLORS.textMuted,
                fontFamily: 'var(--font-mono)',
              }}>
                {body.length}/{MAX_COMMENT_LENGTH}
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                style={{
                  background: COLORS.orange,
                  color: '#0a0908',
                  border: 'none',
                  borderRadius: RADIUS.md,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: pending ? 'wait' : 'pointer',
                  opacity: pending ? 0.7 : 1,
                }}
              >
                {pending ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
