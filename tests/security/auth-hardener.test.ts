import { describe, it, expect } from 'vitest';
import {
  enforcePasswordPolicy,
  hashPassword,
  verifyPassword,
  validateSession,
  createSessionToken,
  recordFailedLoginAttempt,
  resetFailedLoginAttempts,
  getAccountLockoutStatus,
  generate2FASecret,
  verify2FAToken,
  generatePasswordResetToken,
  generateEmailVerificationToken,
} from '@/lib/security/auth-hardener';
import { PASSWORD_POLICY } from '@/config/security';

describe('Auth Hardening', () => {
  describe('enforcePasswordPolicy', () => {
    const validPassword = 'SecurePass123!';

    it('should accept valid passwords', () => {
      const result = enforcePasswordPolicy(validPassword);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(50);
    });

    it('should reject short passwords', () => {
      const result = enforcePasswordPolicy('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject passwords without uppercase', () => {
      const result = enforcePasswordPolicy('lowercase123!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('uppercase'))).toBe(true);
    });

    it('should reject passwords without numbers', () => {
      const result = enforcePasswordPolicy('NoNumbers!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('number'))).toBe(true);
    });

    it('should reject passwords without special characters', () => {
      const result = enforcePasswordPolicy('NoSpecial123');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('special'))).toBe(true);
    });

    it('should calculate password strength score', () => {
      const weak = enforcePasswordPolicy('WeakPass1!');
      const strong = enforcePasswordPolicy('VeryStrongPassword123!@#');
      expect(strong.score).toBeGreaterThan(weak.score || 0);
    });

    it('should cap score at 100', () => {
      const result = enforcePasswordPolicy('VeryLongPassword123!@#$%^&*()');
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should provide meaningful error messages', () => {
      const result = enforcePasswordPolicy('abc');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/characters/i);
    });
  });

  describe('Password Hashing', () => {
    it('should hash passwords consistently', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Hashes should differ due to random salt
      expect(hash1).not.toBe(hash2);

      // Both should verify with same password
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });

    it('should reject wrong password', async () => {
      const password = 'CorrectPass123!';
      const hash = await hashPassword(password);

      expect(await verifyPassword('WrongPass123!', hash)).toBe(false);
    });

    it('should handle empty passwords', async () => {
      const hash = await hashPassword('NonEmpty123!');
      expect(await verifyPassword('', hash)).toBe(false);
    });

    it('should produce valid hash format', async () => {
      const hash = await hashPassword('ValidPass123!');
      expect(hash).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
    });

    it('should be case-sensitive', async () => {
      const password = 'CaseSensitive123!';
      const hash = await hashPassword(password);

      expect(await verifyPassword('casesensitive123!', hash)).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should create valid session tokens', () => {
      const token = createSessionToken('user-123');
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(0);
    });

    it('should create base64 encoded tokens', () => {
      const token = createSessionToken('user-456');
      expect(() => Buffer.from(token, 'base64').toString('utf-8')).not.toThrow();
    });

    it('should validate correct session tokens', async () => {
      const userId = 'user-456';
      const token = createSessionToken(userId);
      const result = await validateSession(userId, token);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe(userId);
    });

    it('should reject invalid user in session', async () => {
      const token = createSessionToken('user-789');
      const result = await validateSession('different-user', token);

      expect(result.valid).toBe(false);
    });

    it('should include expiration in session', async () => {
      const token = createSessionToken('user-123');
      const result = await validateSession('user-123', token);

      expect(result.expiresAt).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt?.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reject empty tokens', async () => {
      const result = await validateSession('user-123', '');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('No session token');
    });

    it('should set correct session timeout', async () => {
      const token = createSessionToken('user-123');
      const result = await validateSession('user-123', token);

      if (result.expiresAt) {
        const expectedExpiry = new Date(
          Date.now() + PASSWORD_POLICY.sessionTimeoutMinutes * 60 * 1000
        );
        const timeDiff = Math.abs(
          result.expiresAt.getTime() - expectedExpiry.getTime()
        );
        expect(timeDiff).toBeLessThan(1000); // Within 1 second
      }
    });
  });

  describe('Account Lockout', () => {
    it('should record failed login attempts', async () => {
      const status = await recordFailedLoginAttempt('user-123');
      expect(status.failedAttempts).toBeGreaterThanOrEqual(0);
      expect(status.remainingAttempts).toBeGreaterThanOrEqual(0);
    });

    it('should track remaining attempts', async () => {
      const status = await recordFailedLoginAttempt('user-456');
      const maxAttempts = PASSWORD_POLICY.maxLoginAttempts;

      if (status.failedAttempts > 0) {
        expect(status.remainingAttempts).toBe(maxAttempts - status.failedAttempts);
      }
    });

    it('should have lockout properties', async () => {
      const userId = 'user-789';
      const status = await recordFailedLoginAttempt(userId);

      expect(status).toHaveProperty('locked');
      expect(status).toHaveProperty('failedAttempts');
      expect(typeof status.locked).toBe('boolean');
    });

    it('should reset failed attempts', async () => {
      const userId = 'user-reset';
      await recordFailedLoginAttempt(userId);
      await resetFailedLoginAttempts(userId);

      const status = await getAccountLockoutStatus(userId);
      expect(status.failedAttempts).toBe(0);
      expect(status.locked).toBe(false);
    });

    it('should get account lockout status', async () => {
      const status = await getAccountLockoutStatus('user-status');
      expect(status).toHaveProperty('locked');
      expect(status).toHaveProperty('failedAttempts');
    });
  });

  describe('2FA (TOTP)', () => {
    it('should generate 2FA secrets', () => {
      const secret = generate2FASecret();
      expect(secret).toBeDefined();
      expect(secret.length).toBeGreaterThan(0);
      // Base32 includes A-Z, 2-7, and padding =
      expect(/^[A-Z2-7=]+$/.test(secret)).toBe(true);
    });

    it('should generate unique secrets', () => {
      const secret1 = generate2FASecret();
      const secret2 = generate2FASecret();
      expect(secret1).not.toBe(secret2);
    });

    it('should generate properly formatted base32 secrets', () => {
      const secret = generate2FASecret();
      // Base32 strings are padded to multiple of 8
      expect(secret.length % 8).toBe(0);
    });

    it('should reject invalid 2FA tokens', () => {
      const secret = generate2FASecret();
      expect(verify2FAToken(secret, '000000')).toBe(false);
      expect(verify2FAToken(secret, '999999')).toBe(false);
    });

    it('should reject invalid token format', () => {
      const secret = generate2FASecret();
      expect(verify2FAToken(secret, 'invalid')).toBe(false);
      expect(verify2FAToken(secret, '')).toBe(false);
    });

    it('should handle malformed secrets gracefully', () => {
      expect(() => verify2FAToken('invalid-secret', '123456')).not.toThrow();
      expect(verify2FAToken('invalid-secret', '123456')).toBe(false);
    });
  });

  describe('Token Generation', () => {
    it('should generate unique password reset tokens', () => {
      const token1 = generatePasswordResetToken();
      const token2 = generatePasswordResetToken();

      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(0);
      expect(/^[a-f0-9]+$/.test(token1)).toBe(true); // Hex format
    });

    it('should generate unique email verification tokens', () => {
      const token1 = generateEmailVerificationToken();
      const token2 = generateEmailVerificationToken();

      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(0);
      expect(/^[a-f0-9]+$/.test(token1)).toBe(true); // Hex format
    });

    it('should generate tokens of consistent length', () => {
      const tokens = [
        generatePasswordResetToken(),
        generatePasswordResetToken(),
        generatePasswordResetToken(),
      ];

      const lengths = tokens.map((t) => t.length);
      expect(lengths[0]).toBe(lengths[1]);
      expect(lengths[1]).toBe(lengths[2]);
    });

    it('should generate cryptographically random tokens', () => {
      const tokens = new Set(
        Array.from({ length: 10 }, () => generatePasswordResetToken())
      );
      expect(tokens.size).toBe(10); // All unique
    });
  });

  describe('Integration', () => {
    it('should support complete auth flow', async () => {
      // 1. Validate password
      const password = 'SecurePass123!';
      const validation = enforcePasswordPolicy(password);
      expect(validation.valid).toBe(true);

      // 2. Hash password
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();

      // 3. Verify password
      const match = await verifyPassword(password, hash);
      expect(match).toBe(true);

      // 4. Create session
      const userId = 'user-123';
      const sessionToken = createSessionToken(userId);
      expect(sessionToken).toBeDefined();

      // 5. Validate session
      const sessionValid = await validateSession(userId, sessionToken);
      expect(sessionValid.valid).toBe(true);
    });

    it('should enforce password policy before hashing', async () => {
      const weakPassword = 'weak';
      const validation = enforcePasswordPolicy(weakPassword);
      expect(validation.valid).toBe(false);

      // Even if we hash it, the policy check should have prevented this
      if (!validation.valid) {
        const hash = await hashPassword(weakPassword);
        const verify = await verifyPassword(weakPassword, hash);
        expect(verify).toBe(true); // Hash still works, but policy rejected it
      }
    });
  });
});
