import { Link } from '@/lib/nav';
import { COLORS, BRAND_RIBBON, RADIUS, SPACE, BRAND_GRADIENT } from '@/lib/theme';

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
        <div aria-hidden style={{ height: 6, background: BRAND_RIBBON }} />
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
  inputMode,
}: {
  inputMode?: 'email' | 'text';
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
        inputMode={inputMode}
        autoCapitalize={inputMode === 'email' ? 'none' : undefined}
        autoCorrect={inputMode === 'email' ? 'off' : undefined}
        spellCheck={inputMode === 'email' ? false : undefined}
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

export function SubmitButton({ children, busy }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      style={{
        opacity: busy ? 0.6 : 1,
        marginTop: SPACE.sm,
        background: BRAND_GRADIENT,
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
      background: 'rgba(156, 204, 101, 0.12)',
      border: `1px solid ${COLORS.green}`,
      borderRadius: RADIUS.md,
      padding: '10px 12px',
      fontSize: 13,
      color: COLORS.text,
    }}>
      {children}
    </div>
  );
}
