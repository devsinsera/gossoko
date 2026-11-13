// Phone push. After every sign-in the native shell asks for permission (once) and registers its
// APNs (iPhone/iPad) or FCM (Android) token with the database (gossoko.register_push_token), which
// binds the device to the account now signed in. Signing out unbinds it, so the next person on the
// phone doesn't get the last account's alerts. Tapping an alert opens Alerts. Does nothing on the web.

import { registerPlugin } from '@capacitor/core';
import { supabase as getSupabase } from '@/lib/supabase/client';

interface PushPlugin {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  createChannel(c: { id: string; name: string; description?: string; importance: number; visibility?: number; sound?: string }): Promise<void>;
  addListener(ev: 'registration', fn: (t: { value: string }) => void): Promise<unknown>;
  addListener(ev: 'registrationError', fn: (e: { error: string }) => void): Promise<unknown>;
  addListener(ev: 'pushNotificationReceived', fn: (n: unknown) => void): Promise<unknown>;
  addListener(ev: 'pushNotificationActionPerformed', fn: (a: unknown) => void): Promise<unknown>;
}
type CapacitorLike = { getPlatform?: () => string; isPluginAvailable?: (n: string) => boolean };

/** Android channel the server sends to (gossoko-push sets android.notification.channel_id). */
export const ANDROID_CHANNEL = 'gossoko_alerts';
export const OPEN_EVENT = 'gossoko:open';
const TOKEN_KEY = 'gossoko.push.token';

let plugin: PushPlugin | null = null;
let platform: 'ios' | 'android' | null = null;
let listening = false;

function store(): Storage | null { try { return localStorage; } catch { return null; } }

function nativePush(): PushPlugin | null {
  if (plugin) return plugin;
  const cap = (globalThis as { Capacitor?: CapacitorLike }).Capacitor;
  const p = cap?.getPlatform?.();
  if ((p !== 'ios' && p !== 'android') || !cap?.isPluginAvailable?.('PushNotifications')) return null;
  platform = p;
  plugin = registerPlugin<PushPlugin>('PushNotifications');
  return plugin;
}

async function saveToken(value: string): Promise<void> {
  store()?.setItem(TOKEN_KEY, value);
  const { error } = await getSupabase().rpc('register_push_token', { p_token: value, p_platform: platform });
  if (error) console.warn('[gossoko] push token not saved:', error.message);
}

/** Call after every sign-in (also after a restored session): binds this phone to the signed-in account. */
export async function enablePush(): Promise<void> {
  const push = nativePush();
  if (!push) return;
  try {
    if (!listening) {
      listening = true;
      await push.addListener('registration', ({ value }) => { void saveToken(value); });
      await push.addListener('registrationError', (e) => console.warn('[gossoko] push registration failed:', e.error));
      // Arrived while the app is open: refresh the Alerts badge.
      await push.addListener('pushNotificationReceived', () => window.dispatchEvent(new Event('gossoko:notices')));
      // Tapped: open Alerts.
      await push.addListener('pushNotificationActionPerformed', () => {
        window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: '/notifications' }));
      });
      if (platform === 'android') {
        await push.createChannel({ id: ANDROID_CHANNEL, name: 'Alerts', description: 'Reviews, replies, claims and staff alerts', importance: 4, visibility: 1, sound: 'default' }).catch(() => {});
      }
    }
    let perm = await push.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await push.requestPermissions();
    if (perm.receive !== 'granted') return;
    // register() fires 'registration' again with the same token; saving it re-binds it to this account.
    await push.register();
  } catch (e) {
    listening = false;
    console.warn('[gossoko] push unavailable:', e);
  }
}

/** Call BEFORE signing out (needs the session): this phone stops getting that account's alerts. */
export async function disablePush(): Promise<void> {
  if (!nativePush()) return;
  const token = store()?.getItem(TOKEN_KEY);
  if (!token) return;
  const { error } = await getSupabase().rpc('unregister_push_token', { p_token: token });
  if (error) console.warn('[gossoko] push token not released:', error.message);
}
