import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Handles Supabase email confirmation + magic links + recovery callbacks.
// The email template emits links of the form:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
// On success we redirect to ?next= (defaulting to /), otherwise to /login
// with an error message.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/';

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('Invalid confirmation link')}`, origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, origin));
  }

  return NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', origin));
}
