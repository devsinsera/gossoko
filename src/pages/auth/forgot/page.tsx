import { useState, type FormEvent } from 'react';
import { Link } from '@/lib/nav';
import { COLORS, SPACE } from '@/lib/theme';
import { requestPasswordReset } from '@/lib/api/auth';
import { AuthShell, Field, SubmitButton, InfoBanner } from '../../_auth/AuthShell';

export default function ForgotPage() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    setBusy(true);
    await requestPasswordReset(email);
    setBusy(false);
    // Always the same answer, so it can't be used to find which emails exist.
    setSent(true);
  }

  return (
    <AuthShell title="RESET PASSWORD" subtitle="We'll email you a link">
      {sent && (
        <div style={{ marginBottom: SPACE.md }}>
          <InfoBanner>
            If that email is on file, a reset link is on its way. Check your inbox (and spam).
          </InfoBanner>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <SubmitButton busy={busy}>Send reset link</SubmitButton>
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
