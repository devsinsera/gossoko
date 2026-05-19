import Link from 'next/link';
import { COLORS, SPACE } from '@/lib/theme';
import { signupAction } from './actions';
import { AuthShell, Field, SubmitButton, ErrorBanner } from '../_auth/AuthShell';

export const dynamic = 'force-dynamic';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; username?: string; next?: string }>;
}) {
  const { error, email, username, next } = await searchParams;

  return (
    <AuthShell title="CREATE ACCOUNT" subtitle="Get on the queue">
      <form action={signupAction} style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <input type="hidden" name="next" value={next ?? '/'} />
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={email ?? ''} required />
        <Field
          label="Username"
          name="username"
          autoComplete="username"
          defaultValue={username ?? ''}
          required
          minLength={3}
          hint="3–32 chars · letters, numbers, underscore"
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          hint="12+ chars · upper, lower, number, symbol"
        />
        <SubmitButton>Create account</SubmitButton>
      </form>

      <p style={{ marginTop: SPACE.lg, fontSize: 13, color: COLORS.textSecondary }}>
        Already on the queue?{' '}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} style={{ color: COLORS.orange, textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
