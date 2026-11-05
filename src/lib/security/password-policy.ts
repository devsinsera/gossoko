// Browser-safe password policy check (no Node crypto). auth-hardener re-exports it.
import { PASSWORD_POLICY } from '@/config/security';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  score?: number; // Password strength score 0-100
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
