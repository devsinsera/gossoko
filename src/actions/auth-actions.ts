'use server';

import { createClient } from '@/lib/supabase/server';
import {
  enforcePasswordPolicy,
  recordFailedLoginAttempt,
  resetFailedLoginAttempts,
} from '@/lib/security/auth-hardener';

export interface SignupResult {
  success: boolean;
  errors?: string[];
  email?: string;
  username?: string;
  needsEmailConfirmation?: boolean;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

export interface SessionValidationResult {
  valid: boolean;
  userId?: string;
  email?: string;
  reason?: string;
}

/**
 * Sign up a new user via Supabase Auth, then create a matching profile row.
 * Password policy is enforced client- and server-side; Supabase Auth handles
 * password hashing internally.
 */
export async function signupUser(
  email: string,
  password: string,
  username: string
): Promise<SignupResult> {
  if (!isValidEmail(email)) {
    return { success: false, errors: ['Invalid email format'] };
  }
  const cleanUsername = normalizeUsername(username);
  if (!isValidUsername(cleanUsername)) {
    return {
      success: false,
      errors: ['Username must be 3-32 characters · letters, numbers, spaces, underscores'],
    };
  }
  const passwordValidation = enforcePasswordPolicy(password);
  if (!passwordValidation.valid) {
    return { success: false, errors: passwordValidation.errors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username: cleanUsername } },
  });

  if (error) {
    return { success: false, errors: [error.message] };
  }
  if (!data.user) {
    return { success: false, errors: ['Signup failed: no user returned'] };
  }

  // Create profile row. RLS allows users to insert their own profile when
  // role = 'user'. If a server-side trigger is added later this becomes a noop
  // via the unique-id conflict and can be removed.
  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    email,
    username: cleanUsername,
    role: 'user',
  });
  if (profileError && !profileError.message.includes('duplicate')) {
    console.error('[gossoko] profile creation failed:', profileError.message);
  }

  return {
    success: true,
    email,
    username: cleanUsername,
    needsEmailConfirmation: !data.session,
  };
}

/**
 * Log in via Supabase Auth (email + password). Account-lockout + failed-attempt
 * tracking from auth-hardener wrap the call for defense in depth.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<LoginResult> {
  const lockoutStatus = await recordFailedLoginAttempt(email);
  if (lockoutStatus.locked) {
    return {
      success: false,
      error: `Account temporarily locked. Try again after ${lockoutStatus.unlocksAt?.toLocaleTimeString()}`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { success: false, error: error?.message ?? 'Invalid email or password' };
  }

  await resetFailedLoginAttempts(email);

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', data.user.id)
    .maybeSingle();

  return {
    success: true,
    user: {
      id: data.user.id,
      email: data.user.email ?? email,
      username: (profile?.username as string | undefined) ?? '',
    },
  };
}

/**
 * Validate the current session by asking Supabase for the signed-in user.
 * The `_userId` and `_sessionToken` parameters are retained for API
 * compatibility — Supabase reads the session from request cookies.
 */
export async function validateUserSession(
  _userId: string,
  _sessionToken: string
): Promise<SessionValidationResult> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { valid: false, reason: error?.message ?? 'no session' };
  }
  return { valid: true, userId: user.id, email: user.email };
}

/**
 * Log out the current user via Supabase Auth. The `_sessionToken` parameter
 * is retained for API compatibility — Supabase clears the session cookie.
 */
export async function logoutUser(_sessionToken?: string): Promise<{ success: boolean }> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { success: true };
}

/**
 * Send a password-reset email via Supabase Auth.
 */
export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; message?: string }> {
  if (!isValidEmail(email)) {
    return { success: false, message: 'Invalid email format' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${publicSiteUrl()}/auth/reset`,
  });
  if (error) {
    // Don't reveal whether the email exists — return generic success either way.
    console.warn('[gossoko] password reset request failed:', error.message);
  }
  return { success: true, message: 'If that email exists, a reset link has been sent.' };
}

/**
 * Complete a password reset. The caller must already be signed in via the
 * recovery link from email (Supabase exchanges the token for a session).
 */
export async function resetPassword(
  _email: string,
  _resetToken: string,
  newPassword: string
): Promise<{ success: boolean; errors?: string[] }> {
  const validation = enforcePasswordPolicy(newPassword);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, errors: [error.message] };
  }
  return { success: true };
}

/**
 * Change password for the authenticated user. Supabase requires a current
 * session; we additionally verify the current password by attempting a
 * re-authentication so a stolen cookie can't rotate the password silently.
 */
export async function changePassword(
  _userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; errors?: string[] }> {
  const validation = enforcePasswordPolicy(newPassword);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }
  if (currentPassword === newPassword) {
    return {
      success: false,
      errors: ['New password must be different from current password'],
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { success: false, errors: ['Not signed in'] };
  }

  // Re-authenticate to verify the current password.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) {
    return { success: false, errors: ['Current password is incorrect'] };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, errors: [error.message] };
  }
  return { success: true };
}

// ============================================================================
// Helpers
// ============================================================================

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function normalizeUsername(username: string): string {
  // Trim ends and collapse runs of internal whitespace to a single space.
  return username.trim().replace(/\s+/g, ' ');
}

function isValidUsername(username: string): boolean {
  // Letters, numbers, spaces (single, internal only — normalize first), underscores.
  const usernameRegex = /^[a-zA-Z0-9_](?:[a-zA-Z0-9_ ]{1,30}[a-zA-Z0-9_])?$/;
  return usernameRegex.test(username) && username.length >= 3 && username.length <= 32;
}

function publicSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL
    ?? process.env.VERCEL_URL?.replace(/^/, 'https://')
    ?? 'http://localhost:3000'
  );
}
