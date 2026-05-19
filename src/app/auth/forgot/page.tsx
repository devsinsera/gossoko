import Link from 'next/link';
import { COLORS, SPACE } from '@/lib/theme';
import { forgotAction } from './actions';
import { AuthShell, Field, SubmitButton, InfoBanner } from '../../_auth/AuthShell';

export const dynamic = 'force-dynamic';

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; email?: string }>;
}) {
  const { sent, email } = await searchParams;

  return (
    <AuthShell title="RESET PASSWORD" subtitle="We'll email you a link">
      {sent && (
        <div style={{ marginBottom: SPACE.md }}>
          <InfoBanner>
            If that email is on file, a reset link is on its way. Check your inbox (and spam).
          </InfoBanner>
        </div>
      )}

      <form action={forgotAction} style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={email ?? ''} required />
        <SubmitButton>Send reset link</SubmitButton>
      </form>

      <p style={{ marginTop: SPACE.lg, fontSize: 13, color: COLORS.textSecondary }}>
        Remembered it?{' '}
        <Link href="/login" style={{ color: COLORS.orange, textDecoration: 'none' }}>
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
