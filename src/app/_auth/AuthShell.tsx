import Link from 'next/link';
import { COLORS, HAZARD_STRIPES, RADIUS, SPACE } from '@/lib/theme';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bg,
      color: COLORS.text,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: SPACE.lg,
    }}>
      <header style={{ width: '100%', maxWidth: 420, marginTop: SPACE.xl, marginBottom: SPACE.xl }}>
        <Link href="/" style={{ color: COLORS.textSecondary, textDecoration: 'none', fontSize: 13 }}>
          ← Gossoko
        </Link>
      </header>

      <section style={{
        width: '100%',
        maxWidth: 420,
        background: COLORS.surface,
        border: `1.5px solid ${COLORS.border}`,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
      }}>
        <div aria-hidden style={{ height: 6, background: HAZARD_STRIPES }} />
        <div style={{ padding: SPACE.lg }}>
          <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1 }}>{title}</h1>
          {subtitle && (
            <p style={{ margin: `${SPACE.xs}px 0 ${SPACE.lg}px`, color: COLORS.textSecondary, fontSize: 13 }}>
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </section>
    </div>
  );
}

export function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  autoComplete,
  required,
  minLength,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  hint?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: COLORS.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        style={{
          background: COLORS.bgElev,
          color: COLORS.text,
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md,
          padding: '10px 12px',
          fontSize: 15,
          outline: 'none',
        }}
      />
      {hint && (
        <span style={{ fontSize: 11, color: COLORS.textMuted }}>{hint}</span>
      )}
    </label>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      style={{
        marginTop: SPACE.sm,
        background: COLORS.orange,
        color: '#0a0908',
        border: 'none',
        borderRadius: RADIUS.md,
        padding: '12px',
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: 0.5,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(230, 57, 70, 0.15)',
      border: `1px solid ${COLORS.red}`,
      borderRadius: RADIUS.md,
      padding: '10px 12px',
      fontSize: 13,
      color: COLORS.text,
    }}>
      {children}
    </div>
  );
}

export function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(168, 224, 0, 0.10)',
      border: `1px solid ${COLORS.hiVisGreen}`,
      borderRadius: RADIUS.md,
      padding: '10px 12px',
      fontSize: 13,
      color: COLORS.text,
    }}>
      {children}
    </div>
  );
}
