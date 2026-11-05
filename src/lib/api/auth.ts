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
  if (data.session) {
    const { error: profileError } = await sb.from('profiles').insert({
      id: data.user.id, email, username: cleanUsername, role: 'user',
    });
    if (profileError && !/duplicate|unique/i.test(profileError.message)) {
      console.error('[gossoko] profile creation failed:', profileError.message);
    }
  }
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
  const username = normalizeUsername(String(user.user_metadata?.username ?? email.split('@')[0] ?? ''));
  const { error: insErr } = await sb.from('profiles').insert({ id: user.id, email, username, role: 'user' });
  if (insErr && !/duplicate|unique/i.test(insErr.message)) {
    console.error('[gossoko] profile creation failed:', insErr.message);
  }
}
