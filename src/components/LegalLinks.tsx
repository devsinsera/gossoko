import { legalHref } from '@/site/native';
import { COLORS } from '@/lib/theme';

/**
 * Privacy policy + Terms of use. Shown on the web AND in the iPhone/iPad/Android apps (the stores
 * require it); the pages hold no prices. Plain <a>: they are static files the server serves.
 */
export function LegalLinks({ prefix, style }: { prefix?: string; style?: React.CSSProperties }) {
  const base = import.meta.env.BASE_URL;
  const link = { color: COLORS.textSecondary, textDecoration: 'underline', display: 'inline-block', padding: '12px 6px' } as const;
  return (
    <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 13, color: COLORS.textMuted, ...style }}>
      {prefix}
      <a href={legalHref('privacy', base)} style={link}>Privacy policy</a>
      {prefix ? ' and ' : ' · '}
      <a href={legalHref('terms', base)} style={link}>Terms of use</a>
    </p>
  );
}
