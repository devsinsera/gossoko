import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link, safeNext, useQuery } from '@/lib/nav';
import { COLORS, SPACE } from '@/lib/theme';
import { LegalLinks } from '@/components/LegalLinks';
import { signupUser, type AccountType } from '@/lib/api/auth';
import { AuthShell, Field, SubmitButton, ErrorBanner } from '../_auth/AuthShell';

export default function SignupPage() {
  const { next, type } = useQuery('next', 'type');
  // Two kinds of account: a customer (finds and rates spots) or a shop (claims its venue, then runs deals and replies).
  const [account, setAccount] = useState<AccountType>(type === 'shop' ? 'shop' : 'customer');
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
    const r = await signupUser(email, password, username, account);
    // A shop goes on to My venues, where claiming its venue starts.
    const after = account === 'shop' && !next ? '/manage' : next;
    setBusy(false);
    if (!r.success) { setError(r.errors?.join(' · ') ?? 'Signup failed'); return; }
    if (r.needsEmailConfirmation) {
      navigate(`/login?notice=${encodeURIComponent('Check your email to confirm your account.')}&email=${encodeURIComponent(email)}${after ? `&next=${encodeURIComponent(after)}` : ''}`, { replace: true });
      return;
    }
    navigate(safeNext(after), { replace: true });
  }

  return (
    <AuthShell title="CREATE ACCOUNT" subtitle="Get on the queue">
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <legend style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 }}>This account is for</legend>
          {([['customer', 'A customer', 'Find and rate spots'], ['shop', 'A shop', 'Run your venue page']] as const).map(([value, label, hint]) => (
            <label key={value} style={{ display: 'block', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${account === value ? COLORS.orange : COLORS.border}`, background: COLORS.surface }}>
              <input type="radio" name="account_type" value={value} checked={account === value} onChange={() => setAccount(value)} style={{ marginRight: 6 }} />
              <strong style={{ color: COLORS.text, fontSize: 14 }}>{label}</strong>
              <span style={{ display: 'block', fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{hint}</span>
            </label>
          ))}
        </fieldset>
        {account === 'shop' && (
          <p style={{ fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 1.45, margin: 0 }}>
            After you sign in, find your venue (or add it) and tap Claim this venue. Your shop tools open once we&rsquo;ve checked the claim.
          </p>
        )}
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
