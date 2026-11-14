// The one Supabase client. Defaults to the `gossoko` schema, so
// supabase.from('venues') hits gossoko.venues.
//
// Remember me decides whether the session outlives the app/tab. Where it lives
// is decided in sessionStore.ts: the Keychain on a phone/tablet, Web Storage
// on the open web.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';
import { createSessionStore, type SessionStore } from '@/lib/supabase/sessionStore';
import { keychainSlot } from '@/lib/bio';

const REMEMBER_KEY = 'gossoko.remember';
export const AUTH_STORAGE_KEY = 'gossoko.auth';

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export function getRemember(): boolean {
  return safe(() => localStorage.getItem(REMEMBER_KEY) !== '0', true);
}

export function setRemember(on: boolean): void {
  safe(() => localStorage.setItem(REMEMBER_KEY, on ? '1' : '0'), undefined);
}

let store: SessionStore | null = null;
/** Built on first use, so the native shell has injected Capacitor by then. */
export function authStore(): SessionStore {
  store ??= createSessionStore({
    secure: keychainSlot(AUTH_STORAGE_KEY),
    local: safe(() => localStorage, null),
    session: safe(() => sessionStorage, null),
    remember: getRemember,
    onError: (op) => console.warn(`[gossoko] keychain ${op} failed`),
  });
  return store;
}

// Loose generics: there is no generated Database type, and the schema is 'gossoko'.
type Client = SupabaseClient<any, any, any>;
let client: Client | null = null;

export function configured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function supabase(): Client {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Gossoko is not configured: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing.');
  }
  client ??= createClient<any, any, any>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: 'gossoko' },
    auth: {
      storage: authStore(),
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client as Client;
}
