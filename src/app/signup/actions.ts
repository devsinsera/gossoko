'use server';

import { redirect } from 'next/navigation';
import { signupUser } from '@/actions/auth-actions';

export async function signupAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/') || '/';

  const result = await signupUser(email, password, username);
  if (!result.success) {
    const params = new URLSearchParams({
      error: result.errors?.join(' · ') ?? 'Signup failed',
      email,
      username,
    });
    if (next !== '/') params.set('next', next);
    redirect(`/signup?${params.toString()}`);
  }

  if (result.needsEmailConfirmation) {
    redirect(`/login?notice=${encodeURIComponent('Check your email to confirm your account.')}&email=${encodeURIComponent(email)}`);
  }

  redirect(safeRedirect(next));
}

function safeRedirect(target: string): string {
  if (target.startsWith('/') && !target.startsWith('//')) return target;
  return '/';
}
