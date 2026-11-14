import { describe, it, expect, vi } from 'vitest';
import { createSessionStore, looksLikeSession, type SecureSlot, type WebStore } from '@/lib/supabase/sessionStore';
import { keychainSlot, keychainServer, type NativeBiometricPlugin } from '@/lib/bio';

const KEY = 'gossoko.auth';
const SESSION = JSON.stringify({ access_token: 'a1', refresh_token: 'r1', user: { id: 'u1' } });
const ROTATED = JSON.stringify({ access_token: 'a2', refresh_token: 'r2', user: { id: 'u1' } });

function mem(): WebStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}
function slot(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(KEY, initial);
  return {
    data,
    read: vi.fn(async (k: string) => data.get(k) ?? null),
    write: vi.fn(async (k: string, v: string) => { data.set(k, v); }),
    clear: vi.fn(async (k: string) => { data.delete(k); }),
  };
}

describe('looksLikeSession', () => {
  it('accepts a supabase session and rejects the old bare token / junk', () => {
    expect(looksLikeSession(SESSION)).toBe(true);
    expect(looksLikeSession('v1.bare-refresh-token')).toBe(false);
    expect(looksLikeSession('{not json')).toBe(false);
    expect(looksLikeSession('{"a":1}')).toBe(false);
    expect(looksLikeSession(null)).toBe(false);
  });
});

describe('web (no Keychain): unchanged behaviour', () => {
  it('Remember me on → localStorage', () => {
    const local = mem(); const session = mem();
    const s = createSessionStore({ secure: null, local, session, remember: () => true });
    expect(s.kind).toBe('web');
    s.setItem(KEY, SESSION);
    expect(local.data.get(KEY)).toBe(SESSION);
    expect(session.data.has(KEY)).toBe(false);
    expect(s.getItem(KEY)).toBe(SESSION);
  });
  it('Remember me off → sessionStorage only, a stale localStorage copy is never read back', () => {
    const local = mem(); const session = mem();
    local.data.set(KEY, 'stale');
    const s = createSessionStore({ secure: null, local, session, remember: () => false });
    expect(s.getItem(KEY)).toBeNull();
    s.setItem(KEY, SESSION);
    expect(session.data.get(KEY)).toBe(SESSION);
    expect(local.data.has(KEY)).toBe(false);
  });
});

describe('native: the session lives in the Keychain, never in Web Storage', () => {
  it('Remember me on: writes go to the Keychain (awaited), nothing to localStorage', async () => {
    const local = mem(); const session = mem(); const secure = slot();
    const s = createSessionStore({ secure, local, session, remember: () => true });
    expect(s.kind).toBe('keychain');
    await s.setItem(KEY, SESSION);
    expect(secure.data.get(KEY)).toBe(SESSION);
    expect(local.data.size).toBe(0);
    expect(session.data.size).toBe(0);
    await s.setItem(KEY, ROTATED);
    expect(secure.data.get(KEY)).toBe(ROTATED);
    expect(await s.getItem(KEY)).toBe(ROTATED);
  });

  it('a fresh launch reads the session back from the Keychain', async () => {
    const secure = slot(SESSION);
    const s = createSessionStore({ secure, local: mem(), session: mem(), remember: () => true });
    expect(await s.getItem(KEY)).toBe(SESSION);
    await s.getItem(KEY);
    expect(secure.read).toHaveBeenCalledTimes(1);   // then served from memory
  });

  it('removes a copy an older build left in localStorage/sessionStorage', async () => {
    const local = mem(); const session = mem();
    local.data.set(KEY, SESSION); session.data.set(KEY, SESSION);
    const s = createSessionStore({ secure: slot(), local, session, remember: () => true });
    expect(await s.getItem(KEY)).toBeNull();
    expect(local.data.has(KEY)).toBe(false);
    expect(session.data.has(KEY)).toBe(false);
  });

  it('Remember me off: memory only, and the Keychain copy is cleared', async () => {
    const secure = slot(SESSION);
    const s = createSessionStore({ secure, local: mem(), session: mem(), remember: () => false });
    expect(await s.getItem(KEY)).toBeNull();        // not read back on launch
    await s.setItem(KEY, ROTATED);
    expect(secure.data.has(KEY)).toBe(false);
    expect(secure.write).not.toHaveBeenCalled();
    expect(await s.getItem(KEY)).toBe(ROTATED);     // still signed in for this run
  });

  it('the old bare refresh-token item is not handed to supabase-js as a session', async () => {
    const s = createSessionStore({ secure: slot('bare-refresh-token'), local: mem(), session: mem(), remember: () => true });
    expect(await s.getItem(KEY)).toBeNull();
  });

  it('removeItem (sign out) clears memory, Web Storage and the Keychain', async () => {
    const secure = slot(); const local = mem();
    const s = createSessionStore({ secure, local, session: mem(), remember: () => true });
    await s.setItem(KEY, SESSION);
    local.data.set(KEY, 'x');
    await s.removeItem(KEY);
    expect(secure.data.has(KEY)).toBe(false);
    expect(local.data.has(KEY)).toBe(false);
    expect(await s.getItem(KEY)).toBeNull();
  });

  it('a Keychain failure never breaks sign-in and reports the operation name only (no token)', async () => {
    const onError = vi.fn();
    const secure: SecureSlot = {
      read: async () => { throw new Error('boom'); },
      write: async () => { throw new Error('boom'); },
      clear: async () => { throw new Error('boom'); },
    };
    const s = createSessionStore({ secure, local: mem(), session: mem(), remember: () => true, onError });
    await expect(s.setItem(KEY, SESSION)).resolves.toBeUndefined();
    expect(await s.getItem(KEY)).toBe(SESSION);
    await s.removeItem(KEY);
    expect(await s.getItem(KEY)).toBeNull();
    expect(onError.mock.calls.flat()).toEqual(['write', 'clear', 'read']);
    expect(JSON.stringify(onError.mock.calls)).not.toContain('r1');
  });
});

describe('keychainSlot (NativeBiometric plugin)', () => {
  function plugin(): NativeBiometricPlugin & { items: Map<string, { username: string; password: string }> } {
    const items = new Map<string, { username: string; password: string }>();
    return {
      items,
      isAvailable: async () => ({ isAvailable: true, biometryType: 2 }),
      verifyIdentity: async () => undefined,
      setCredentials: async ({ username, password, server }) => { items.set(server, { username, password }); },
      getCredentials: async ({ server }) => { const c = items.get(server); if (!c) throw new Error('not found'); return c; },
      deleteCredentials: async ({ server }) => { if (!items.delete(server)) throw new Error('not found'); },
    };
  }
  it('is null on the open web', () => {
    expect(keychainSlot(KEY, null)).toBeNull();
  });
  it('keeps the main key on the server older builds used; other keys get their own item', () => {
    expect(keychainServer(KEY, KEY)).toBe('sinsera.co/gossoko');
    expect(keychainServer(`${KEY}-code-verifier`, KEY)).toBe('sinsera.co/gossoko#gossoko.auth-code-verifier');
  });
  it('round-trips, and a missing item reads as null / clears quietly', async () => {
    const p = plugin(); const s = keychainSlot(KEY, p)!;
    expect(await s.read(KEY)).toBeNull();
    await s.write(KEY, SESSION);
    expect(p.items.get('sinsera.co/gossoko')?.password).toBe(SESSION);
    expect(await s.read(KEY)).toBe(SESSION);
    await s.clear(KEY);
    await expect(s.clear(KEY)).resolves.toBeUndefined();
    expect(await s.read(KEY)).toBeNull();
  });
});
