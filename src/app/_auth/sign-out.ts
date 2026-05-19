'use server';

import { redirect } from 'next/navigation';
import { logoutUser } from '@/actions/auth-actions';

export async function signOutAction(): Promise<void> {
  await logoutUser();
  redirect('/login?notice=' + encodeURIComponent('Signed out.'));
}
