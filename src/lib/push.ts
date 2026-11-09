// Phone push: after sign-in the native shell asks for permission and registers its APNs token with the
// database (gossoko.register_push_token). Does nothing on the open web or where the plugin is missing.

import { registerPlugin } from '@capacitor/core';
import { supabase as getSupabase } from '@/lib/supabase/client';

interface PushPlugin {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  addListener(ev: 'registration', fn: (t: { value: string }) => void): Promise<unknown>;
  addListener(ev: 'registrationError', fn: (e: { error: string }) => void): Promise<unknown>;
}
type CapacitorLike = { getPlatform?: () => string; isPluginAvailable?: (n: string) => boolean };

let started = false;

export async function enablePush(): Promise<void> {
  if (started) return;
  const cap = (globalThis as { Capacitor?: CapacitorLike }).Capacitor;
  const platform = cap?.getPlatform?.();
  if (platform !== 'ios' ||!cap?.isPluginAvailable?.('PushNotifications')) return;
  started = true;
  try {
    const push = registerPlugin<PushPlugin>('PushNotifications');
    await push.addListener('registration', async ({ value }) => {
      const { error } = await getSupabase().rpc('register_push_token', { p_token: value, p_platform: platform });
      if (error) console.warn('push token not saved:', error.message);
    });
    await push.addListener('registrationError', (e) => console.warn('push registration failed:', e.error));
    let perm = await push.checkPermissions();
    if (perm.receive === 'prompt') perm = await push.requestPermissions();
    if (perm.receive === 'granted') await push.register();
  } catch (e) {
    started = false;
    console.warn('push unavailable:', e);
  }
}
