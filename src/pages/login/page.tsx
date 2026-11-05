import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link, safeNext, useQuery } from '@/lib/nav';
import { COLORS, SPACE } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { getRemember } from '@/lib/supabase/client';
import { isValidEmail } from '@/lib/api/auth';
import { AuthShell, Field, SubmitButton, ErrorBanner, InfoBanner } from '../_auth/AuthShell';

export default function LoginPage() {
  const { next, notice, email, error: qError } = useQuery('next', 'notice', 'email', 'error');
  const { signInPassword } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(qError ?? null);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(getRemember());

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const em = String(form.get('email') ?? '').trim();
    const pw = String(form.get('password') ?? '');
    if (!isValidEmail(em)) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    setError(null);
    const r = await signInPassword(em, pw, remember);
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    // Leave the form straight away so iOS offers to save the password.
    navigate(safeNext(next), { replace: true });
  }

  return (
    <AuthShell title="SIGN IN" subtitle="Get back to the queue">
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        {notice && <InfoBanner>{notice}</InfoBanner>}
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Field label="Email" name="email" type="email" autoComplete="username" defaultValue={email ?? ''} required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: COLORS.textSecondary }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me
        </label>
        <SubmitButton busy={busy}>{busy ? 'Signing in…' : 'Sign in'}</SubmitButton>
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
