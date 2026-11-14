import { describe, it, expect, vi } from 'vitest';
import { bootStep, enableBiometrics, passBiometricGate, shouldOfferBiometrics, signInWithRemember } from '@/lib/authFlow';

describe('bootStep (app opening)', () => {
  const base = { hasSession: false, native: true, bioOn: false, remember: true, legacyToken: false };
  it('saved session, Face ID off → signed in', () => {
    expect(bootStep({ ...base, hasSession: true })).toBe('in');
  });
  it('saved session, Face ID on, phone → locked until the biometric passes', () => {
    expect(bootStep({ ...base, hasSession: true, bioOn: true })).toBe('locked');
  });
  it('Face ID setting is ignored on the open web', () => {
    expect(bootStep({ ...base, hasSession: true, bioOn: true, native: false })).toBe('in');
  });
  it('old-format Keychain token → one-off restore; not with Remember me off or on the web', () => {
    expect(bootStep({ ...base, legacyToken: true })).toBe('legacy');
    expect(bootStep({ ...base, legacyToken: true, remember: false })).toBe('out');
    expect(bootStep({ ...base, legacyToken: true, native: false })).toBe('out');
  });
  it('nothing saved → signed out', () => {
    expect(bootStep(base)).toBe('out');
  });
});

describe('signInWithRemember', () => {
  const user = { id: 'u1' };
  function deps(result: { user: typeof user | null; error?: string }) {
    const order: string[] = [];
    return {
      order,
      d: {
        setRemember: vi.fn((on: boolean) => { order.push(`remember:${on}`); }),
        signIn: vi.fn(async () => { order.push('signIn'); return result; }),
        clearSaved: vi.fn(async () => { order.push('clear'); }),
        ensureProfile: vi.fn(async () => { order.push('profile'); }),
      },
    };
  }
  it('stores the Remember-me choice BEFORE signing in (the store reads it on the first write)', async () => {
    const { d, order } = deps({ user });
    expect(await signInWithRemember(d, 'a@b.co', 'pw', true)).toEqual({ user });
    expect(order).toEqual(['remember:true', 'signIn', 'profile']);
    expect(d.clearSaved).not.toHaveBeenCalled();
  });
  it('Remember me off clears any saved copy', async () => {
    const { d, order } = deps({ user });
    await signInWithRemember(d, 'a@b.co', 'pw', false);
    expect(order).toEqual(['remember:false', 'signIn', 'clear', 'profile']);
  });
  it('a failed sign-in returns the error and touches nothing else', async () => {
    const { d } = deps({ user: null, error: 'Invalid login credentials' });
    expect(await signInWithRemember(d, 'a@b.co', 'bad', true)).toEqual({ error: 'Invalid login credentials' });
    expect(d.ensureProfile).not.toHaveBeenCalled();
    expect(d.clearSaved).not.toHaveBeenCalled();
  });
});

describe('biometric gate', () => {
  it('stays locked when Face ID fails or is cancelled, and never reads the session', async () => {
    const currentSession = vi.fn(async () => ({ id: 's' }));
    const r = await passBiometricGate({ verify: async () => false, currentSession, restoreLegacy: async () => null });
    expect(r).toEqual({ result: 'locked' });
    expect(currentSession).not.toHaveBeenCalled();
  });
  it('lets the saved session through after Face ID passes', async () => {
    const r = await passBiometricGate({ verify: async () => true, currentSession: async () => ({ id: 's' }), restoreLegacy: async () => null });
    expect(r).toEqual({ result: 'in', session: { id: 's' } });
  });
  it('falls back to the old Keychain token, else signs out', async () => {
    expect(await passBiometricGate({ verify: async () => true, currentSession: async () => null, restoreLegacy: async () => ({ id: 'old' }) }))
      .toEqual({ result: 'in', session: { id: 'old' } });
    expect(await passBiometricGate({ verify: async () => true, currentSession: async () => null, restoreLegacy: async () => null }))
      .toEqual({ result: 'out' });
  });
});

describe('Enable Face ID', () => {
  it('is offered only after sign-in, with Remember me on, on a capable device, once', () => {
    const ok = { signedIn: true, asked: false, remember: true, available: true };
    expect(shouldOfferBiometrics(ok)).toBe(true);
    expect(shouldOfferBiometrics({ ...ok, signedIn: false })).toBe(false);
    expect(shouldOfferBiometrics({ ...ok, asked: true })).toBe(false);
    expect(shouldOfferBiometrics({ ...ok, remember: false })).toBe(false);
    expect(shouldOfferBiometrics({ ...ok, available: false })).toBe(false);
  });
  it('turns on only after a successful check', async () => {
    const setOn = vi.fn(); const markAsked = vi.fn();
    expect(await enableBiometrics({ verify: async () => true, setOn, markAsked }, 'Face ID')).toBe(true);
    expect(setOn).toHaveBeenCalledWith(true);
    setOn.mockClear();
    expect(await enableBiometrics({ verify: async () => false, setOn, markAsked }, 'Face ID')).toBe(false);
    expect(setOn).not.toHaveBeenCalled();
    expect(markAsked).toHaveBeenCalled();
  });
});
