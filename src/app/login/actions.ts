'use server';

import { redirect } from 'next/navigation';
import { loginUser } from '@/actions/auth-actions';

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/') || '/';

  const result = await loginUser(email, password);
  if (!result.success) {
    const params = new URLSearchParams({ error: result.error ?? 'Login failed', email });
    if (next !== '/') params.set('next', next);
    redirect(`/login?${params.toString()}`);
  }

  redirect(safeRedirect(next));
}

function safeRedirect(target: string): string {
  // Only allow same-origin relative paths.
  if (target.startsWith('/') && !target.startsWith('//')) return target;
  return '/';
}
