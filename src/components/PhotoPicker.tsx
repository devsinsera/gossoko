import { useEffect, useRef, useState } from 'react';
import { COLORS, RADIUS } from '@/lib/theme';

/** What the picker button says: "Add photos", then "3 photos" once some are picked. */
export function pickerLabel(count: number, max: number, label = 'Add photos'): string {
  if (count <= 0) return label;
  const shown = Math.min(count, max);
  return `${shown} photo${shown === 1 ? '' : 's'} · change`;
}

type Props = {
  /** Form field name: the files go with the form (review form). */
  name?: string;
  /** Called with the picked files right away (owner dashboard uploads at once). */
  onFiles?: (files: File[]) => void;
  max: number;
  accept?: string;
  disabled?: boolean;
  label?: string;
  hint?: string;
};

/**
 * A styled "Add photos" button over a hidden native file input (same accept/multiple, same
 * FormData field), with the count and small previews of what was picked.
 */
export function PhotoPicker({ name, onFiles, max, accept = 'image/*', disabled, label = 'Add photos', hint }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ name: string; url: string }[]>([]);
  const [extra, setExtra] = useState(0);

  useEffect(() => () => { for (const p of picked) URL.revokeObjectURL(p.url); }, [picked]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (onFiles) {
      onFiles(files);
      e.target.value = '';          // pick the same file again later
      return;
    }
    setExtra(Math.max(0, files.length - max));
    setPicked(files.slice(0, max).map((f) => ({ name: f.name, url: URL.createObjectURL(f) })));
  }

  function clear() {
    if (ref.current) ref.current.value = '';
    setPicked([]);
    setExtra(0);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        ref={ref}
        type="file"
        name={name}
        accept={accept}
        multiple={max > 1}
        disabled={disabled}
        onChange={onChange}
        tabIndex={-1}
        aria-hidden
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => ref.current?.click()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: COLORS.bgElev,
            color: disabled ? COLORS.textMuted : COLORS.orange,
            border: `1.5px dashed ${disabled ? COLORS.border : COLORS.orange}`,
            borderRadius: RADIUS.md,
            padding: '10px 14px',
            fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
            cursor: disabled ? 'not-allowed' : 'pointer',
            minHeight: 44,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
          </svg>
          {pickerLabel(picked.length, max, label)}
        </button>
        {picked.length > 0 && (
          <button type="button" onClick={clear} style={{ background: 'none', border: 'none', color: COLORS.textSecondary, textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 4 }}>
            Remove
          </button>
        )}
      </div>
      {picked.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {picked.map((p) => (
            <img key={p.url} src={p.url} alt={p.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: `1px solid ${COLORS.border}` }} />
          ))}
        </div>
      )}
      {extra > 0 && <span style={{ fontSize: 12, color: COLORS.gold }}>Only the first {max} will upload.</span>}
      {hint && <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{hint}</span>}
    </div>
  );
}
