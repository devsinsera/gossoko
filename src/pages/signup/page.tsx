import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link, safeNext, useQuery } from '@/lib/nav';
import { COLORS, SPACE } from '@/lib/theme';
import { signupUser } from '@/lib/api/auth';
import { AuthShell, Field, SubmitButton, ErrorBanner } from '../_auth/AuthShell';

export default function SignupPage() {
  const { next } = useQuery('next');
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const username = String(form.get('username') ?? '').trim();
    const password = String(form.get('password') ?? '');
    setBusy(true);
    setError(null);
    const r = await signupUser(email, password, username);
    setBusy(false);
    if (!r.success) { setError(r.errors?.join(' · ') ?? 'Signup failed'); return; }
    if (r.needsEmailConfirmation) {
      navigate(`/login?notice=${encodeURIComponent('Check your email to confirm your account.')}&email=${encodeURIComponent(email)}`, { replace: true });
      return;
    }
    navigate(safeNext(next), { replace: true });
  }

  return (
    <AuthShell title="CREATE ACCOUNT" subtitle="Get on the queue">
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {/* Keychain AutoFill saves the field marked "username" — that must be the email the login box accepts, not the display name. */}
        <Field label="Email" name="email" type="email" autoComplete="username" required />
        <Field
          label="Username"
          name="username"
          autoComplete="nickname"
          required
          minLength={3}
          hint="3–32 chars · letters, numbers, spaces, underscore"
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
        <SubmitButton busy={busy}>Create account</SubmitButton>
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
