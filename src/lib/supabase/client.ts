// The one Supabase client. Defaults to the `gossoko` schema, so
// supabase.from('venues') hits gossoko.venues.
//
// Remember me decides where the session lives: on = localStorage (kept across
// launches), off = sessionStorage (gone when the tab/app closes).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

const REMEMBER_KEY = 'gossoko.remember';

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export function getRemember(): boolean {
  return safe(() => localStorage.getItem(REMEMBER_KEY) !== '0', true);
}

export function setRemember(on: boolean): void {
  safe(() => localStorage.setItem(REMEMBER_KEY, on ? '1' : '0'), undefined);
}

const authStorage = {
  // Remember me off = this tab only: a copy left in localStorage is never read back (same rule as TagTrail).
  getItem: (k: string) =>
    safe(() => sessionStorage.getItem(k), null) ?? (getRemember() ? safe(() => localStorage.getItem(k), null) : null),
  setItem: (k: string, v: string) => {
    const keep = getRemember();
    safe(() => (keep ? localStorage : sessionStorage).setItem(k, v), undefined);
    safe(() => (keep ? sessionStorage : localStorage).removeItem(k), undefined);
  },
  removeItem: (k: string) => {
    safe(() => localStorage.removeItem(k), undefined);
    safe(() => sessionStorage.removeItem(k), undefined);
  },
};

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
      storage: authStorage,
      storageKey: 'gossoko.auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client as Client;
}
