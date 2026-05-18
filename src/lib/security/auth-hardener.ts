import crypto from 'crypto';
import { PASSWORD_POLICY } from '@/config/security';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  score?: number; // Password strength score 0-100
}

export interface SessionValidation {
  valid: boolean;
  userId?: string;
  expiresAt?: Date;
  reason?: string;
}

export interface AccountLockoutStatus {
  locked: boolean;
  failedAttempts: number;
  unlocksAt?: Date;
  remainingAttempts?: number;
}

/**
 * Enforce password policy from security config.
 * @param password - Raw password to validate
 * @returns Validation result with score
 */
export function enforcePasswordPolicy(password: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    score: 0,
  };

  // Check length
  if (password.length < PASSWORD_POLICY.minLength) {
    result.errors.push(
      `Password must be at least ${PASSWORD_POLICY.minLength} characters`
    );
    result.valid = false;
  }

  // Check for uppercase
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    result.errors.push('Password must contain at least one uppercase letter');
    result.valid = false;
  }

  // Check for numbers
  if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) {
    result.errors.push('Password must contain at least one number');
    result.valid = false;
  }

  // Check for special characters
  if (
    PASSWORD_POLICY.requireSpecialChars &&
    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  ) {
    result.errors.push('Password must contain at least one special character');
    result.valid = false;
  }

  // Calculate strength score
  let score = 0;
  score += Math.min((password.length / 20) * 30, 30); // Length: 0-30 points
  if (/[a-z]/.test(password)) score += 10; // Lowercase
  if (/[A-Z]/.test(password)) score += 10; // Uppercase
  if (/[0-9]/.test(password)) score += 10; // Numbers
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 30; // Special chars

  result.score = Math.min(score, 100);

  return result;
}

/**
 * Hash password using PBKDF2.
 * @param password - Raw password
 * @returns Hashed password with salt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return `${salt.toString('hex')}:${hash}`;
}

/**
 * Verify password against hash.
 * @param password - Raw password
 * @param hash - Stored hash
 * @returns true if password matches
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    const [saltHex, hashHex] = hash.split(':');
    if (!saltHex || !hashHex) {
      return false;
    }
    const salt = Buffer.from(saltHex, 'hex');
    const testHash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
      .toString('hex');
    return testHash === hashHex;
  } catch (error) {
    return false;
  }
}

/**
 * Validate session token and check expiration.
 * @param userId - User ID
 * @param sessionToken - Session token to validate
 * @returns Validation result
 */
export async function validateSession(
  userId: string,
  sessionToken: string
): Promise<SessionValidation> {
  if (!sessionToken) {
    return { valid: false, reason: 'No session token' };
  }

  try {
    // Decode session token
    const sessionData = Buffer.from(sessionToken, 'base64').toString('utf-8');
    const pipeIndex = sessionData.indexOf('|');
    if (pipeIndex === -1) {
      return { valid: false, reason: 'Invalid session token format' };
    }

    const storedUserId = sessionData.substring(0, pipeIndex);
    const expiresAtStr = sessionData.substring(pipeIndex + 1);

    if (storedUserId !== userId) {
      return { valid: false, reason: 'User ID mismatch' };
    }

    const expiresAt = new Date(expiresAtStr);
    if (isNaN(expiresAt.getTime())) {
      return { valid: false, reason: 'Invalid session expiration' };
    }

    if (expiresAt < new Date()) {
      return { valid: false, reason: 'Session expired' };
    }

    return {
      valid: true,
      userId: storedUserId,
      expiresAt,
    };
  } catch (error) {
    return { valid: false, reason: 'Invalid session token' };
  }
}

/**
 * Create new session token.
 * @param userId - User ID
 * @returns Session token
 */
export function createSessionToken(userId: string): string {
  const expiresAt = new Date(
    Date.now() + PASSWORD_POLICY.sessionTimeoutMinutes * 60 * 1000
  );
  // Use pipe separator to avoid conflicts with ISO date format colons
  const sessionData = `${userId}|${expiresAt.toISOString()}`;
  return Buffer.from(sessionData).toString('base64');
}

/**
 * Record failed login attempt and check lockout.
 * @param userId - User ID
 * @returns Account lockout status
 */
export async function recordFailedLoginAttempt(
  _userId: string
): Promise<AccountLockoutStatus> {
  // TODO: Integrate with Redis for production
  // const key = `auth:failed:${userId}`;
  // const attempts = await redis.incr(key);
  // await redis.expire(key, PASSWORD_POLICY.lockoutDurationMinutes * 60);

  const maxAttempts = PASSWORD_POLICY.maxLoginAttempts;
  const lockoutDuration = PASSWORD_POLICY.lockoutDurationMinutes;

  // Mock: assume no lockout for now (production: check Redis)
  const failedAttempts = 1; // In production: get from Redis
  const locked = failedAttempts >= maxAttempts;

  return {
    locked,
    failedAttempts,
    unlocksAt: locked ? new Date(Date.now() + lockoutDuration * 60 * 1000) : undefined,
    remainingAttempts: maxAttempts - failedAttempts,
  };
}

/**
 * Reset failed login attempts.
 * @param userId - User ID
 */
export async function resetFailedLoginAttempts(_userId: string): Promise<void> {
  // TODO: Integrate with Redis
  // const key = `auth:failed:${userId}`;
  // await redis.del(key);
}

/**
 * Check if user account is locked.
 * @param userId - User ID
 * @returns Lockout status
 */
export async function getAccountLockoutStatus(
  _userId: string
): Promise<AccountLockoutStatus> {
  // TODO: Integrate with Redis
  // const key = `auth:failed:${userId}`;
  // const attempts = await redis.get(key);

  return {
    locked: false,
    failedAttempts: 0,
  };
}

/**
 * Generate 2FA secret for TOTP (Time-based One-Time Password).
 * @returns Base32-encoded secret
 */
export function generate2FASecret(): string {
  const bytes = crypto.randomBytes(32);
  return base32Encode(bytes);
}

/**
 * Verify 2FA TOTP token.
 * @param secret - Base32-encoded secret
 * @param token - 6-digit token from authenticator
 * @param window - Time window in steps (default ±1)
 * @returns true if token is valid
 */
export function verify2FAToken(
  secret: string,
  token: string,
  window: number = 1
): boolean {
  try {
    const decoded = base32Decode(secret);
    const now = Math.floor(Date.now() / 30000); // 30-second window

    for (let i = -window; i <= window; i++) {
      const timeCounter = Buffer.alloc(8);
      timeCounter.writeBigInt64BE(BigInt(now + i), 0);

      const hmac = crypto
        .createHmac('sha1', decoded)
        .update(timeCounter)
        .digest();

      const offset = hmac[hmac.length - 1] & 0x0f;
      const code =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

      const testToken = (code % 1000000).toString().padStart(6, '0');
      if (testToken === token) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Base32 encoding for 2FA secrets.
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }

  while (result.length % 8) {
    result += '=';
  }

  return result;
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const result: number[] = [];

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '=') break;

    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(result);
}

/**
 * Generate secure random token for password reset.
 * @returns Random token (hex)
 */
export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate secure random token for email verification.
 * @returns Random token (hex)
 */
export function generateEmailVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
