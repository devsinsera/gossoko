'use server';

import { redirect } from 'next/navigation';
import { resetPassword } from '@/actions/auth-actions';

export async function resetAction(formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password !== confirm) {
    redirect(`/auth/reset?error=${encodeURIComponent('Passwords do not match')}`);
  }

  const result = await resetPassword('', '', password);
  if (!result.success) {
    redirect(`/auth/reset?error=${encodeURIComponent(result.errors?.join(' · ') ?? 'Reset failed')}`);
  }

  redirect('/login?notice=' + encodeURIComponent('Password updated. Sign in with your new password.'));
}
