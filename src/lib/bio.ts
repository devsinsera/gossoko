// Face ID / Touch ID / Optic ID and the Keychain, through the NativeBiometric
// Capacitor plugin. The installed apps load this page from sinsera.co, so the
// page asks Capacitor whether the shell has the plugin and registers it
// through @capacitor/core. On the open web every call reports "unavailable".

import { registerPlugin } from '@capacitor/core';
import { KEYCHAIN_SERVER } from '@/lib/env';
import type { SecureSlot } from '@/lib/supabase/sessionStore';

export interface NativeBiometricPlugin {
  isAvailable(options?: { useFallback?: boolean }): Promise<{ isAvailable: boolean; biometryType?: number }>;
  verifyIdentity(options?: {
    reason?: string; title?: string; subtitle?: string;
    useFallback?: boolean; fallbackTitle?: string; negativeButtonText?: string;
  }): Promise<void>;
  setCredentials(options: { username: string; password: string; server: string }): Promise<void>;
  getCredentials(options: { server: string }): Promise<{ username: string; password: string }>;
  deleteCredentials(options: { server: string }): Promise<void>;
}

type CapacitorLike = { getPlatform?: () => string; isPluginAvailable?: (name: string) => boolean };

export type BioKind = 'face' | 'touch' | 'fingerprint' | 'other' | 'none';

let registered: NativeBiometricPlugin | null = null;

export function nativePlugin(): NativeBiometricPlugin | null {
  try {
    const cap = (globalThis as { Capacitor?: CapacitorLike }).Capacitor;
    const platform = cap?.getPlatform?.();
    if (platform !== 'ios' && platform !== 'android') return null;
    if (!cap?.isPluginAvailable?.('NativeBiometric')) return null;
    registered ??= registerPlugin<NativeBiometricPlugin>('NativeBiometric');
    return registered;
  } catch {
    return null;
  }
}

export function isNative(): boolean {
  const p = (globalThis as { Capacitor?: CapacitorLike }).Capacitor?.getPlatform?.();
  return p === 'ios' || p === 'android';
}

export function kindFromType(type: number | undefined): BioKind {
  switch (type) {
    case 2: case 4: return 'face';
    case 1: return 'touch';
    case 3: return 'fingerprint';
    case 0: case undefined: return 'none';
    default: return 'other';
  }
}

export const bioWords = (k: BioKind): string =>
  k === 'face' ? 'Face ID' : k === 'touch' ? 'Touch ID' : k === 'fingerprint' ? 'your fingerprint'
    : k === 'other' ? 'biometrics' : '';

export async function bioKind(): Promise<BioKind> {
  const p = nativePlugin();
  if (!p) return 'none';
  try {
    // useFallback true: the device passcode counts, so a phone without
    // enrolled biometrics can still gate the app.
    const r = await p.isAvailable({ useFallback: true });
    return r.isAvailable ? kindFromType(r.biometryType) : 'none';
  } catch {
    return 'none';
  }
}

/** True when the owner passed the check (biometric, or device passcode as the fallback). */
export async function verifyOwner(reason: string): Promise<boolean> {
  const p = nativePlugin();
  if (!p) return false;
  try {
    await p.verifyIdentity({ reason, title: 'Gossoko', subtitle: reason, useFallback: true });
    return true;
  } catch {
    return false;
  }
}

/** The Keychain item a storage key lives in. The main session key keeps the server older builds used. */
export function keychainServer(key: string, mainKey: string): string {
  return key === mainKey ? KEYCHAIN_SERVER : `${KEYCHAIN_SERVER}#${key}`;
}

/**
 * The session's Keychain slot (iOS Keychain; Android Keystore-encrypted store),
 * or null on the open web. `plugin` is injectable for tests.
 */
export function keychainSlot(mainKey: string, plugin: NativeBiometricPlugin | null = nativePlugin()): SecureSlot | null {
  if (!plugin) return null;
  return {
    async read(key) {
      try {
        const c = await plugin.getCredentials({ server: keychainServer(key, mainKey) });
        return c?.password || null;
      } catch {
        return null;              // nothing saved yet
      }
    },
    write: (key, value) => plugin.setCredentials({ username: 'gossoko-session', password: value, server: keychainServer(key, mainKey) }),
    async clear(key) {
      try { await plugin.deleteCredentials({ server: keychainServer(key, mainKey) }); } catch { /* nothing saved */ }
    },
  };
}
