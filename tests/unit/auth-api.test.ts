import { describe, it, expect } from 'vitest';
import { isValidEmail, isValidUsername, normalizeUsername } from '@/lib/api/auth';
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
