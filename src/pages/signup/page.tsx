import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link, safeNext, useQuery } from '@/lib/nav';
import { COLORS, SPACE } from '@/lib/theme';
import { LegalLinks } from '@/components/LegalLinks';
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
    // The terms say accounts are for people 16 or over; the box is the consent record.
    if (form.get('consent') !== 'on') { setError('Tick the box to confirm you are 16 or over and agree to the Terms and Privacy policy.'); return; }
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
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.4 }}>
          <input type="checkbox" name="consent" required style={{ marginTop: 3 }} />
          <span>I&rsquo;m 16 or over, and I agree to the Terms of use and Privacy policy.</span>
        </label>
        <SubmitButton busy={busy}>Create account</SubmitButton>
      </form>

      <LegalLinks style={{ marginTop: SPACE.md, textAlign: 'left' }} />

      <p style={{ marginTop: SPACE.lg, fontSize: 13, color: COLORS.textSecondary }}>
        Already on the queue?{' '}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} style={{ color: COLORS.orange, textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
