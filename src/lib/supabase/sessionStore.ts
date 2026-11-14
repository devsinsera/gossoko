// Where supabase-js keeps the signed-in session.
//
// Sign-in rule (every Sinsera app): on a phone or tablet the session lives in
// the iOS Keychain (Android: the Keystore-encrypted store), never in the
// WebView's localStorage. So:
//   * native  — the live session is held in memory; with Remember me on, the
//               one saved copy is the Keychain item, written (and awaited)
//               every time supabase-js rotates the tokens. Remember me off =
//               memory only, gone when the app closes. Any copy an older build
//               left in localStorage/sessionStorage is removed on first read.
//   * web     — unchanged: Remember me on = localStorage, off = sessionStorage
//               (this tab only; a copy left in localStorage is never read back).
//
// Nothing here logs a token. Failures are reported by name only.

export type WebStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** One secure slot per storage key (the Keychain / Keystore). */
export interface SecureSlot {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  clear(key: string): Promise<void>;
}

export interface SessionStoreOptions {
  /** The Keychain-backed slot, or null on the open web / when the shell lacks the plugin. */
  secure: SecureSlot | null;
  local: WebStore | null;
  session: WebStore | null;
  remember: () => boolean;
  /** A Keychain read/write/clear failed. Gets the operation name only — never the value. */
  onError?: (op: 'read' | 'write' | 'clear') => void;
}

export interface SessionStore {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
  /** 'keychain' on a phone/tablet, 'web' in a browser. */
  readonly kind: 'keychain' | 'web';
}

function quiet<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

/** A supabase-js session is a JSON object. Older builds kept a bare refresh token in the same Keychain item. */
export function looksLikeSession(v: string | null | undefined): v is string {
  if (!v || v[0] !== '{') return false;
  try {
    const o = JSON.parse(v) as { refresh_token?: unknown };
    return typeof o?.refresh_token === 'string';
  } catch {
    return false;
  }
}

export function createSessionStore(o: SessionStoreOptions): SessionStore {
  const { local, session } = o;

  if (!o.secure) {
    return {
      kind: 'web',
      getItem: (k) =>
        quiet(() => session?.getItem(k) ?? null, null) ?? (o.remember() ? quiet(() => local?.getItem(k) ?? null, null) : null),
      setItem: (k, v) => {
        const keep = o.remember();
        quiet(() => (keep ? local : session)?.setItem(k, v), undefined);
        quiet(() => (keep ? session : local)?.removeItem(k), undefined);
      },
      removeItem: (k) => {
        quiet(() => local?.removeItem(k), undefined);
        quiet(() => session?.removeItem(k), undefined);
      },
    };
  }

  const secure = o.secure;
  const memory = new Map<string, string>();
  const purgeWeb = (k: string) => {
    quiet(() => local?.removeItem(k), undefined);
    quiet(() => session?.removeItem(k), undefined);
  };
  const clearSecure = async (k: string) => {
    try { await secure.clear(k); } catch { o.onError?.('clear'); }
  };

  return {
    kind: 'keychain',
    async getItem(k) {
      purgeWeb(k);
      const held = memory.get(k);
      if (held !== undefined) return held;
      if (!o.remember()) return null;
      let saved: string | null = null;
      try { saved = await secure.read(k); } catch { o.onError?.('read'); return null; }
      if (!looksLikeSession(saved)) return null;   // nothing saved, or the old bare-token format (see auth boot)
      memory.set(k, saved);
      return saved;
    },
    async setItem(k, v) {
      memory.set(k, v);
      purgeWeb(k);
      if (!o.remember()) { await clearSecure(k); return; }
      // Awaited: a rotated refresh token is saved before supabase-js uses it.
      try { await secure.write(k, v); } catch { o.onError?.('write'); }
    },
    async removeItem(k) {
      memory.delete(k);
      purgeWeb(k);
      await clearSecure(k);
    },
  };
}
