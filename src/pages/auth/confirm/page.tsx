import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { safeNext, useQuery } from '@/lib/nav';
import { COLORS } from '@/lib/theme';

// Email confirmation / magic-link / recovery callback:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
const TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

export default function ConfirmPage() {
  const { token_hash, type, next } = useQuery('token_hash', 'type', 'next');
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const fail = (msg: string) => navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true });
    if (!token_hash || !type || !TYPES.includes(type as EmailOtpType)) { fail('Invalid confirmation link'); return; }
    supabase().auth.verifyOtp({ token_hash, type: type as EmailOtpType }).then(({ error }) => {
      if (error) fail(error.message);
      else navigate(type === 'recovery' ? '/auth/reset' : safeNext(next), { replace: true });
    });
  }, [token_hash, type, next, navigate]);

  return <p style={{ padding: 24, color: COLORS.textSecondary }}>Confirming…</p>;
}
