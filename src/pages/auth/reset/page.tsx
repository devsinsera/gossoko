import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from '@/lib/nav';
import { SPACE } from '@/lib/theme';
import { supabase } from '@/lib/supabase/client';
import { resetPassword } from '@/lib/api/auth';
import { AuthShell, Field, SubmitButton, ErrorBanner } from '../../_auth/AuthShell';

export default function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The recovery link signs the visitor in (supabase-js reads the token from the
  // URL); wait for that session before showing the form.
  useEffect(() => {
    const sb = supabase();
    let live = true;
    sb.auth.getSession().then(({ data }) => { if (live) setReady(Boolean(data.session)); });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (live && (event === 'PASSWORD_RECOVERY' || session)) setReady(true);
    });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');
    if (password !== String(form.get('confirm') ?? '')) { setError('Passwords do not match'); return; }
    setBusy(true);
    setError(null);
    const r = await resetPassword(password);
    setBusy(false);
    if (!r.success) { setError(r.errors?.join(' · ') ?? 'Reset failed'); return; }
    await supabase().auth.signOut();
    navigate('/login?notice=' + encodeURIComponent('Password updated. Sign in with your new password.'), { replace: true });
  }

  return (
    <AuthShell title="NEW PASSWORD" subtitle="Pick something stronger this time">
      {ready === false && (
        <div style={{ marginBottom: SPACE.md }}>
          <ErrorBanner>
            This reset link looks expired or invalid. <Link href="/auth/forgot">Request a new one</Link>.
          </ErrorBanner>
        </div>
      )}
      {error && (
        <div style={{ marginBottom: SPACE.md }}>
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={12} hint="12+ chars · upper, lower, number, symbol" />
        <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required minLength={12} />
        <SubmitButton busy={busy || !ready}>Update password</SubmitButton>
      </form>
    </AuthShell>
  );
}
