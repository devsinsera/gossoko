// The sign-in rule as plain functions, so it can be tested without React,
// Supabase or a phone. auth.tsx wires these to the real pieces.

export type BootStep = 'in' | 'out' | 'locked' | 'legacy';

/**
 * What to do when the app opens.
 *  - a saved session + Face ID on (phone/tablet) → locked until the biometric passes
 *  - a saved session otherwise → signed in
 *  - no session, but an older build left a bare refresh token in the Keychain → restore it once
 *  - otherwise → signed out
 */
export function bootStep(i: {
  hasSession: boolean; native: boolean; bioOn: boolean; remember: boolean; legacyToken: boolean;
}): BootStep {
  if (i.hasSession) return i.native && i.bioOn ? 'locked' : 'in';
  if (i.native && i.remember && i.legacyToken) return 'legacy';
  return 'out';
}

export interface SignInDeps<U> {
  setRemember(on: boolean): void;
  signIn(email: string, password: string): Promise<{ user: U | null; error?: string }>;
  /** Drop any saved (Keychain / localStorage) copy. */
  clearSaved(): Promise<void>;
  ensureProfile(user: U): Promise<unknown>;
}

/**
 * Remember me: the choice is stored BEFORE signing in, because the session
 * store reads it on the very first write. Off = memory/tab only, and any
 * copy a previous Remember-me sign-in left behind is cleared.
 */
export async function signInWithRemember<U>(
  deps: SignInDeps<U>, email: string, password: string, remember: boolean,
): Promise<{ user?: U; error?: string }> {
  deps.setRemember(remember);
  const r = await deps.signIn(email, password);
  if (r.error || !r.user) return { error: r.error ?? 'Invalid email or password' };
  if (!remember) await deps.clearSaved();
  await deps.ensureProfile(r.user);
  return { user: r.user };
}

export interface GateDeps<S> {
  verify(reason: string): Promise<boolean>;
  currentSession(): Promise<S | null>;
  /** Restore from an old-format Keychain token, if one is waiting. */
  restoreLegacy(): Promise<S | null>;
}

/** The lock screen's Unlock: nothing is let through unless the biometric (or passcode fallback) passes. */
export async function passBiometricGate<S>(deps: GateDeps<S>): Promise<{ result: 'in'; session: S } | { result: 'locked' | 'out' }> {
  if (!(await deps.verify('Open Gossoko'))) return { result: 'locked' };
  const s = (await deps.currentSession()) ?? (await deps.restoreLegacy());
  return s ? { result: 'in', session: s } : { result: 'out' };
}

/** Offer Face ID only to someone signed in with Remember me on, on a device that has it, who hasn't answered yet. */
export function shouldOfferBiometrics(i: { signedIn: boolean; asked: boolean; remember: boolean; available: boolean }): boolean {
  return i.signedIn && !i.asked && i.remember && i.available;
}

/** Turning Face ID on proves it works first, so nobody locks themselves out. */
export async function enableBiometrics(
  deps: { verify(reason: string): Promise<boolean>; setOn(on: boolean): void; markAsked(): void }, words: string,
): Promise<boolean> {
  if (await deps.verify(`Turn on ${words} for Gossoko`)) { deps.setOn(true); return true; }
  deps.markAsked();
  return false;
}
