// Account actions that run in the browser against Supabase Auth.
// Supabase itself rate-limits sign-in and sign-up per IP/account and hashes
// passwords; the password policy is checked here first for fast feedback.

import { supabase } from '@/lib/supabase/client';
import { siteUrl } from '@/lib/env';
import { enforcePasswordPolicy } from '@/lib/security/password-policy';

export interface SignupResult {
  success: boolean;
  errors?: string[];
  needsEmailConfirmation?: boolean;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/** Sona accounts were copied into Gossoko as <username>@sona.sinsera.invalid (same password as Sona). */
export const SONA_LOGIN_DOMAIN = 'sona.sinsera.invalid';

/** What the sign-in box holds → the email to sign in with: an email as typed, or a Sona username. */
export function loginEmail(input: string): string | null {
  const v = input.trim();
  if (v.includes('@')) return isValidEmail(v) ? v : null;
  return /^[A-Za-z0-9_.-]{2,32}$/.test(v) ? `${v.toLowerCase()}@${SONA_LOGIN_DOMAIN}` : null;
}

export function normalizeUsername(username: string): string {
  return username.trim().replace(/\s+/g, ' ');
}

export function isValidUsername(username: string): boolean {
  const re = /^[a-zA-Z0-9_](?:[a-zA-Z0-9_ ]{1,30}[a-zA-Z0-9_])?$/;
  return re.test(username) && username.length >= 3 && username.length <= 32;
}

export async function signupUser(email: string, password: string, username: string): Promise<SignupResult> {
  if (!isValidEmail(email)) return { success: false, errors: ['Invalid email format'] };
  const cleanUsername = normalizeUsername(username);
  if (!isValidUsername(cleanUsername)) {
    return { success: false, errors: ['Username must be 3-32 characters · letters, numbers, spaces, underscores'] };
  }
  const policy = enforcePasswordPolicy(password);
  if (!policy.valid) return { success: false, errors: policy.errors };

  const sb = supabase();
  // Check the name first: a taken name would create the login without a profile.
  const { data: free, error: freeErr } = await sb.rpc('username_available', { p_username: cleanUsername });
  if (freeErr) return { success: false, errors: [`Couldn't check that username: ${freeErr.message}`] };
  if (free === false) return { success: false, errors: [`"${cleanUsername}" is taken — try adding your trade or a number.`] };

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { username: cleanUsername },
      emailRedirectTo: `${siteUrl()}/auth/confirm`,
    },
  });
  if (error) return { success: false, errors: [error.message] };
  if (!data.user) return { success: false, errors: ['Signup failed: no user returned'] };

  // With email confirmation on there is no session yet, so the profile row is
  // created by the database trigger/first sign-in, not here (RLS needs a session).
  if (data.session) await ensureProfile(data.user);
  return { success: true, needsEmailConfirmation: !data.session };
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!isValidEmail(email)) return;
  const { error } = await supabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/reset`,
  });
  // Same answer whether or not the address exists.
  if (error) console.warn('[gossoko] password reset request failed:', error.message);
}

export async function resetPassword(newPassword: string): Promise<{ success: boolean; errors?: string[] }> {
  const policy = enforcePasswordPolicy(newPassword);
  if (!policy.valid) return { success: false, errors: policy.errors };
  const { error } = await supabase().auth.updateUser({ password: newPassword });
  if (error) return { success: false, errors: [error.message] };
  return { success: true };
}

/**
 * Make sure the signed-in user has a profile row. Sign-up with email
 * confirmation has no session yet, so the row is created on the first sign-in
 * from the username captured at sign-up.
 */
export async function ensureProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): Promise<void> {
  const sb = supabase();
  const { data, error } = await sb.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (error || data) return;
  const email = user.email ?? '';
  const wanted = normalizeUsername(String(user.user_metadata?.username ?? email.split('@')[0] ?? '')) || 'tradie';
  // If someone took the name between sign-up and first sign-in, add a number
  // rather than leave the account without a profile (it couldn't post).
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = attempt === 0 ? wanted : `${wanted.slice(0, 27)}_${Math.floor(1000 + Math.random() * 9000)}`;
    const { error: insErr } = await sb.from('profiles').insert({ id: user.id, email, username, role: 'user' });
    if (!insErr) return;
    if (/profiles_pkey/i.test(insErr.message)) return; // already has one
    if (!/username|duplicate|unique/i.test(insErr.message)) {
      console.error('[gossoko] profile creation failed:', insErr.message);
      return;
    }
  }
  console.error('[gossoko] profile creation failed: no free username near', wanted);
}
