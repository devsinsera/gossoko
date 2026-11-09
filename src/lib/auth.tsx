// Session state for the whole app.
//
// Sign-in rule (every Sinsera app): Remember me keeps the refresh token in the
// Keychain (native) and refreshes it automatically; after sign-in the app
// offers Face ID / Touch ID / Optic ID; with that on, reopening the app asks
// for the biometric (device passcode as fallback) and, if that fails or is
// cancelled, drops to a full sign-in.

import { enablePush } from '@/lib/push';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, getRemember, setRemember, configured } from '@/lib/supabase/client';
import { KEYCHAIN_SERVER } from '@/lib/env';
import { nativePlugin, verifyOwner } from '@/lib/bio';
import { ensureProfile } from '@/lib/api/auth';

const BIO_KEY = 'gossoko.bio';
const BIO_ASKED_KEY = 'gossoko.bio.asked';

function ls(): Storage | null {
  try { return localStorage; } catch { return null; }
}
export const bioEnabled = () => ls()?.getItem(BIO_KEY) === '1';
export const bioAsked = () => ls()?.getItem(BIO_ASKED_KEY) === '1';
export function setBioEnabled(on: boolean): void {
  ls()?.setItem(BIO_KEY, on ? '1' : '0');
  ls()?.setItem(BIO_ASKED_KEY, '1');
}
export function markBioAsked(): void { ls()?.setItem(BIO_ASKED_KEY, '1'); }

async function keychainSave(email: string, refreshToken: string): Promise<void> {
  const p = nativePlugin();
  if (!p) return;
  try {
    await p.setCredentials({ username: email, password: refreshToken, server: KEYCHAIN_SERVER });
  } catch (e) {
    console.warn('[gossoko] keychain save failed', e);
  }
}
async function keychainRead(): Promise<{ username: string; password: string } | null> {
  const p = nativePlugin();
  if (!p) return null;
  try { return await p.getCredentials({ server: KEYCHAIN_SERVER }); } catch { return null; }
}
async function keychainClear(): Promise<void> {
  const p = nativePlugin();
  if (!p) return;
  try { await p.deleteCredentials({ server: KEYCHAIN_SERVER }); } catch { /* nothing stored */ }
}

export type AuthStatus = 'loading' | 'locked' | 'out' | 'in';

interface AuthValue {
  status: AuthStatus;
  user: User | null;
  /** Keychain refresh-token restore or the biometric check failed/cancelled. */
  unlock: () => Promise<void>;
  signInPassword: (email: string, password: string, remember: boolean) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  /** Drop the lock and show the sign-in form. */
  fullSignIn: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const booted = useRef(false);

  const finishIn = useCallback((u: User) => { setUser(u); setStatus('in'); void enablePush(); }, []);

  const boot = useCallback(async () => {
    if (!configured()) { setStatus('out'); return; }
    const sb = supabase();
    const { data } = await sb.auth.getSession();
    let session = data.session;

    // The WebView's storage can be cleared while the Keychain survives.
    if (!session && getRemember()) {
      const saved = await keychainRead();
      if (saved?.password) {
        if (bioEnabled() && !(await verifyOwner('Open Gossoko'))) { setStatus('locked'); return; }
        const r = await sb.auth.refreshSession({ refresh_token: saved.password });
        session = r.data.session;
        if (!session) await keychainClear();
      }
    } else if (session && bioEnabled() && nativePlugin()) {
      setStatus('locked');
      return;
    }
    if (session) finishIn(session.user); else setStatus('out');
  }, [finishIn]);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    boot().catch((e) => { console.error('[gossoko] boot failed', e); setStatus('out'); });
  }, [boot]);

  // Keep the Keychain copy of the refresh token current, and follow sign-outs.
  useEffect(() => {
    if (!configured()) return;
    const { data: sub } = supabase().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { setUser(null); setStatus('out'); return; }
      if (session && getRemember() && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
        void keychainSave(session.user.email ?? '', session.refresh_token);
      }
      if (event === 'PASSWORD_RECOVERY' && session) finishIn(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [finishIn]);

  const unlock = useCallback(async () => {
    if (!(await verifyOwner('Open Gossoko'))) return;
    const { data } = await supabase().auth.getSession();
    if (data.session) finishIn(data.session.user);
    else await boot();
  }, [boot, finishIn]);

  const signInPassword = useCallback(async (email: string, password: string, remember: boolean) => {
    // Decide where the session is stored before it is written.
    setRemember(remember);
    const { data, error } = await supabase().auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      return { error: error?.message ?? 'Invalid email or password' };
    }
    if (remember) await keychainSave(email, data.session.refresh_token);
    else await keychainClear();
    await ensureProfile(data.user);
    finishIn(data.user);
    return {};
  }, [finishIn]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    await keychainClear();
    ls()?.removeItem(BIO_KEY);
    setUser(null);
    setStatus('out');
  }, []);

  const fullSignIn = useCallback(async () => {
    await supabase().auth.signOut();
    await keychainClear();
    setUser(null);
    setStatus('out');
  }, []);

  const value = useMemo(
    () => ({ status, user, unlock, signInPassword, signOut, fullSignIn }),
    [status, user, unlock, signInPassword, signOut, fullSignIn],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** Current user without needing the context (for query helpers). */
export async function currentUser(): Promise<User | null> {
  const { data } = await supabase().auth.getUser();
  return data.user;
}
