import { SPACE } from '@/lib/theme';
import { createClient } from '@/lib/supabase/server';
import { resetAction } from './actions';
import { AuthShell, Field, SubmitButton, ErrorBanner } from '../../_auth/AuthShell';

export const dynamic = 'force-dynamic';

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { code, error } = await searchParams;

  // Supabase recovery links arrive with `?code=...`. Exchange it for a session
  // so updateUser() below runs against the right user. If there's no code and
  // no existing session, the form will fail at submit — show a hint instead.
  let sessionReady = false;
  const supabase = await createClient();
  if (code) {
    const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
    sessionReady = !exchErr;
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    sessionReady = !!user;
  }

  return (
    <AuthShell title="NEW PASSWORD" subtitle="Pick something stronger this time">
      {!sessionReady && (
        <div style={{ marginBottom: SPACE.md }}>
          <ErrorBanner>
            This reset link looks expired or invalid. Request a new one from /auth/forgot.
          </ErrorBanner>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: SPACE.md }}>
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}

      <form action={resetAction} style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          hint="12+ chars · upper, lower, number, symbol"
        />
        <Field
          label="Confirm new password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
        <SubmitButton>Update password</SubmitButton>
      </form>
    </AuthShell>
  );
}
