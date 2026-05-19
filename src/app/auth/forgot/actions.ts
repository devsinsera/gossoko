'use server';

import { redirect } from 'next/navigation';
import { requestPasswordReset } from '@/actions/auth-actions';

export async function forgotAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  await requestPasswordReset(email);
  // Always show the same generic success to avoid leaking which emails exist.
  redirect(`/auth/forgot?sent=1&email=${encodeURIComponent(email)}`);
}
