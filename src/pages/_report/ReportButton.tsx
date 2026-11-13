
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionForm } from '@/components/ActionForm';
import { COLORS, RADIUS, SPACE, BRAND_GRADIENT } from '@/lib/theme';
import { reportContent } from './actions';

const REPORT_TYPES = [
  { value: 'spam',                label: 'Spam' },
  { value: 'offensive',           label: 'Offensive' },
  { value: 'inappropriate_image', label: 'Inappropriate image' },
  { value: 'fake_venue',          label: 'Fake / wrong venue' },
  { value: 'other',               label: 'Other' },
] as const;

export function ReportButton({
  reportableType,
  reportableId,
  back,
}: {
  reportableType: 'review' | 'comment' | 'user' | 'venue';
  reportableId: string;
  back: string;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
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
        Report
      </button>
    );
  }

  return (
    <ActionForm
      action={(f) => reportContent({
        reportableType,
        reportableId,
        reportType: String(f.get('report_type') ?? ''),
        reason: String(f.get('reason') ?? ''),
      })}
      onDone={(outcome) => {
        // Same banner contract the venue page already reads from ?report=.
        if (outcome === 'unauthenticated') navigate(`/login?next=${encodeURIComponent(back)}`);
        else navigate(`${back}?report=${String(outcome)}`);
        setOpen(false);
      }}
      style={{
        marginTop: SPACE.md,
        padding: SPACE.md,
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.sm,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
        Report this {reportableType}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Reason
        </span>
        <select
          name="report_type"
          defaultValue=""
          required
          style={{
            background: COLORS.bgElev,
            color: COLORS.text,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md,
            padding: '8px 10px',
            fontSize: 14,
          }}
        >
          <option value="" disabled>Pick one…</option>
          {REPORT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Details
        </span>
        <textarea
          name="reason"
          required
          minLength={4}
          rows={3}
          placeholder="What's the problem?"
          style={{
            background: COLORS.bgElev,
            color: COLORS.text,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md,
            padding: '8px 10px',
            fontSize: 14,
            resize: 'vertical',
            minHeight: 60,
            fontFamily: 'inherit',
          }}
        />
      </label>

      <div style={{ display: 'flex', gap: SPACE.sm, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            background: 'transparent',
            border: `1px solid ${COLORS.border}`,
            color: COLORS.textSecondary,
            borderRadius: RADIUS.md,
            padding: '8px 14px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            background: BRAND_GRADIENT,
            color: '#0a0908',
            border: 'none',
            borderRadius: RADIUS.md,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Send report
        </button>
      </div>
    </ActionForm>
  );
}
