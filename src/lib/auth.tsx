// Session state for the whole app.
//
// Sign-in rule (every Sinsera app): Remember me keeps the session in the
// Keychain on a phone/tablet (never the WebView's storage — see
// supabase/sessionStore.ts) and refreshes it automatically; after sign-in the app
// offers Face ID / Touch ID / Optic ID; with that on, reopening the app asks
// for the biometric (device passcode as fallback) and, if that fails or is
// cancelled, drops to a full sign-in.

import { enablePush, disablePush } from '@/lib/push';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, getRemember, setRemember, configured, authStore, AUTH_STORAGE_KEY } from '@/lib/supabase/client';
import { looksLikeSession } from '@/lib/supabase/sessionStore';
import { keychainSlot, nativePlugin, verifyOwner } from '@/lib/bio';
import { bootStep, passBiometricGate, signInWithRemember } from '@/lib/authFlow';
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

/** An older build kept a bare refresh token in the Keychain item; read it once so those installs stay signed in. */
async function legacyKeychainToken(): Promise<string | null> {
  const raw = await keychainSlot(AUTH_STORAGE_KEY)?.read(AUTH_STORAGE_KEY);
  return raw && !looksLikeSession(raw) ? raw : null;
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

  const restoreLegacy = useCallback(async () => {
    const token = await legacyKeychainToken();
    if (!token) return null;
    const r = await supabase().auth.refreshSession({ refresh_token: token });
    if (!r.data.session) await authStore().removeItem(AUTH_STORAGE_KEY);
    return r.data.session;
  }, []);

  const boot = useCallback(async () => {
    if (!configured()) { setStatus('out'); return; }
    const { data } = await supabase().auth.getSession();
    const native = nativePlugin() !== null;
    const legacy = !data.session && native && getRemember() ? await legacyKeychainToken() : null;
    const step = bootStep({
      hasSession: Boolean(data.session), native, bioOn: bioEnabled(), remember: getRemember(), legacyToken: Boolean(legacy),
    });
    if (step === 'in' && data.session) { finishIn(data.session.user); return; }
    if (step === 'locked') { setStatus('locked'); return; }
    if (step === 'legacy') {
      if (bioEnabled() && !(await verifyOwner('Open Gossoko'))) { setStatus('locked'); return; }
      const s = await restoreLegacy();
      if (s) { finishIn(s.user); return; }
    }
    setStatus('out');
  }, [finishIn, restoreLegacy]);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    boot().catch((e) => { console.error('[gossoko] boot failed', e); setStatus('out'); });
  }, [boot]);

  // Follow sign-outs. (The session store itself keeps the Keychain copy current.)
  useEffect(() => {
    if (!configured()) return;
    const { data: sub } = supabase().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { setUser(null); setStatus('out'); return; }
      if (event === 'PASSWORD_RECOVERY' && session) finishIn(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [finishIn]);

  const unlock = useCallback(async () => {
    const r = await passBiometricGate({
      verify: verifyOwner,
      currentSession: async () => (await supabase().auth.getSession()).data.session,
      restoreLegacy,
    });
    if (r.result === 'in') finishIn(r.session.user);
    else if (r.result === 'out') setStatus('out');
  }, [finishIn, restoreLegacy]);

  const signInPassword = useCallback(async (email: string, password: string, remember: boolean) => {
    const r = await signInWithRemember<User>({
      setRemember,
      signIn: async (em, pw) => {
        const { data, error } = await supabase().auth.signInWithPassword({ email: em, password: pw });
        return { user: data.session ? data.user : null, error: error?.message };
      },
      // Remember me off: the store already keeps this session in memory only; drop any older saved copy.
      clearSaved: async () => { await keychainSlot(AUTH_STORAGE_KEY)?.clear(AUTH_STORAGE_KEY); },
      ensureProfile,
    }, email, password, remember);
    if (r.error || !r.user) return { error: r.error ?? 'Invalid email or password' };
    finishIn(r.user);
    return {};
  }, [finishIn]);

  const signOut = useCallback(async () => {
    await disablePush();
    await supabase().auth.signOut();
    await authStore().removeItem(AUTH_STORAGE_KEY);
    ls()?.removeItem(BIO_KEY);
    setUser(null);
    setStatus('out');
  }, []);

  const fullSignIn = useCallback(async () => {
    await disablePush();
    await supabase().auth.signOut();
    await authStore().removeItem(AUTH_STORAGE_KEY);
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
