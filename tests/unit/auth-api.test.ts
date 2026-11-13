import { describe, it, expect } from 'vitest';
import { isValidEmail, isValidUsername, normalizeUsername, loginEmail } from '@/lib/api/auth';
import { enforcePasswordPolicy } from '@/lib/security/password-policy';

// auth.ts builds the Supabase client lazily, so importing it needs no env.
describe('sign-up validation', () => {
  it('accepts normal emails and rejects junk', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a b@c.d')).toBe(false);
  });

  it('normalises whitespace in usernames', () => {
    expect(normalizeUsername('  big   dave ')).toBe('big dave');
  });

  it('enforces username shape', () => {
    expect(isValidUsername('big dave')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername(' lead')).toBe(false);
    expect(isValidUsername('x'.repeat(33))).toBe(false);
    expect(isValidUsername('bad!name')).toBe(false);
  });

  it('password policy is the shared one', () => {
    expect(enforcePasswordPolicy('short').valid).toBe(false);
    expect(enforcePasswordPolicy('Str0ng!Passw0rd#').valid).toBe(true);
  });
});

describe('sign-in box: email or Sona username', () => {
  it('keeps an email as typed', () => {
    expect(loginEmail('  a@b.co ')).toBe('a@b.co');
    expect(loginEmail('a b@c.d')).toBeNull();
  });
  it('maps a bare username to its copied Sona account', () => {
    expect(loginEmail('CarrotSharpner')).toBe('carrotsharpner@sona.sinsera.invalid');
    expect(loginEmail('owner')).toBe('owner@sona.sinsera.invalid');
  });
  it('rejects anything else', () => {
    expect(loginEmail('')).toBeNull();
    expect(loginEmail('two words')).toBeNull();
  });
});
