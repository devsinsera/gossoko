import Link from 'next/link';
import { COLORS, SPACE } from '@/lib/theme';
import { loginAction } from './actions';
import { AuthShell, Field, SubmitButton, ErrorBanner, InfoBanner } from '../_auth/AuthShell';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; next?: string; notice?: string }>;
}) {
  const { error, email, next, notice } = await searchParams;

  return (
    <AuthShell title="SIGN IN" subtitle="Get back to the queue">
      <form action={loginAction} style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <input type="hidden" name="next" value={next ?? '/'} />
        {notice && <InfoBanner>{notice}</InfoBanner>}
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={email ?? ''} required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <SubmitButton>Sign in</SubmitButton>
      </form>

      <div style={{ marginTop: SPACE.lg, fontSize: 13, color: COLORS.textSecondary, display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
        <Link href="/auth/forgot" style={{ color: COLORS.orange, textDecoration: 'none' }}>
          Forgot password?
        </Link>
        <span>
          No account?{' '}
          <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} style={{ color: COLORS.orange, textDecoration: 'none' }}>
            Create one
          </Link>
        </span>
      </div>
    </AuthShell>
  );
}
