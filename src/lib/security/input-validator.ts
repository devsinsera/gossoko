import { z } from 'zod';
import { PASSWORD_POLICY, UPLOAD_LIMITS } from '@/config/security';

// ============================================================================
// PATTERNS & CONSTANTS
// ============================================================================

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const SPECIAL_CHAR_PATTERN = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

// Common passwords that should be rejected (extend as needed)
const COMMON_PASSWORDS = [
  'password123!',
  'password1234!',
  'admin@123',
  'admin@1234',
  'welcome@1',
  'welcome@123',
  'letmein@1',
  'letmein@123',
  'baseball@1',
  'princess@1',
  'trustno1!',
  'dragon@123',
  'monkey@123',
  'master@123',
  'sunshine@123',
  'shadow@123',
  'ashley@123',
  'bailey@123',
  'passw0rd!',
  'password1!',
  'qwerty@123',
  '123456Aa!',
  'Aa@123456',
];

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Username schema: 3-20 chars, lowercase letters, numbers, underscores
 */
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(
    USERNAME_PATTERN,
    'Username can only contain lowercase letters, numbers, and underscores'
  );

/**
 * Email schema: valid format, normalized to lowercase
 */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email is too long')
  .toLowerCase();

/**
 * Password schema enforcing PASSWORD_POLICY from security config
 */
export const passwordSchema = z
  .string()
  .min(
    PASSWORD_POLICY.minLength,
    `Password must be at least ${PASSWORD_POLICY.minLength} characters`
  )
  .refine(
    (pwd) => !PASSWORD_POLICY.requireUppercase || /[A-Z]/.test(pwd),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (pwd) => !PASSWORD_POLICY.requireNumbers || /[0-9]/.test(pwd),
    'Password must contain at least one number'
  )
  .refine(
    (pwd) =>
      !PASSWORD_POLICY.requireSpecialChars || SPECIAL_CHAR_PATTERN.test(pwd),
    'Password must contain at least one special character'
  )
  .refine(
    (pwd) =>
      !PASSWORD_POLICY.preventCommonPasswords ||
      !COMMON_PASSWORDS.includes(pwd.toLowerCase()),
    'This password is too common. Choose a more unique password'
  );

/**
 * UUID validation helper
 */
const uuidSchema = z.string().uuid('Invalid ID format');

/**
 * Review schema: comprehensive validation for all review fields
 */
export const reviewSchema = z.object({
  venue_id: uuidSchema,
  title: z
    .string()
    .min(5, 'Review title must be at least 5 characters')
    .max(100, 'Review title must be at most 100 characters'),
  body: z
    .string()
    .min(20, 'Review must be at least 20 characters')
    .max(2000, 'Review must be at most 2000 characters'),
  coffee_strength_rating: z
    .number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  feed_size_rating: z
    .number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  bang_for_buck_rating: z
    .number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  speed_rating: z
    .number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  ute_parking_rating: z
    .number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  early_open_rating: z
    .number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  service_rating: z
    .number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
});

/**
 * Comment schema: validates review comments with optional parent references
 */
export const commentSchema = z.object({
  review_id: uuidSchema,
  parent_comment_id: uuidSchema.optional(),
  body: z
    .string()
    .min(2, 'Comment must be at least 2 characters')
    .max(1000, 'Comment must be at most 1000 characters'),
});

/**
 * Upload schema: validates file metadata (not binary content)
 */
const allowedMimeTypes = [
  ...UPLOAD_LIMITS.allowedImageTypes,
  ...UPLOAD_LIMITS.allowedDocTypes,
] as const;

export const uploadSchema = z.object({
  filename: z
    .string()
    .min(1, 'Filename is required')
    .max(255, 'Filename is too long')
    .refine(
      (name) => !name.includes('..'),
      'Filename cannot contain path traversal patterns'
    ),
  filesize: z
    .number()
    .int('File size must be a whole number')
    .positive('File size must be positive')
    .max(
      UPLOAD_LIMITS.maxFileSize,
      `File size must not exceed ${UPLOAD_LIMITS.maxFileSize / (1024 * 1024)}MB`
    ),
  mimetype: z
    .enum(allowedMimeTypes, {
      message: 'File type not allowed',
    }),
});

/**
 * Report schema: validates abuse/content reports
 */
export const reportSchema = z.object({
  reported_by: uuidSchema,
  reportable_type: z
    .enum(['review', 'comment', 'venue', 'user'])
    .refine((val) => val !== undefined, 'Invalid report target type'),
  reportable_id: uuidSchema,
  report_type: z
    .enum(['spam', 'offensive', 'inappropriate_image', 'fake_venue', 'other'])
    .refine((val) => val !== undefined, 'Invalid report type'),
  reason: z
    .string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason must be at most 500 characters'),
});

/**
 * Signup schema: combines email, username, and password with confirmation
 */
export const signupSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Login schema: email and password
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Password reset schema: for initiating password reset flow
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

/**
 * Password reset confirmation schema: new password + token/code
 */
export const passwordResetConfirmSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Username = z.infer<typeof usernameSchema>;
export type Email = z.infer<typeof emailSchema>;
export type Password = z.infer<typeof passwordSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;

// ============================================================================
// VALIDATION ERROR HANDLING
// ============================================================================

/**
 * Structured validation error for API responses
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Parse and validate input with structured error response
 * @param schema - Zod schema to validate against
 * @param data - Unknown data to validate
 * @returns Success with data or failure with validation errors
 */
export function parseInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: ValidationError[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }));

  return { success: false, errors };
}

/**
 * Validate input and throw on error (use in backend-only contexts)
 * @param schema - Zod schema to validate against
 * @param data - Unknown data to validate
 * @returns Validated data or throws ZodError
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  return schema.parse(data);
}

// ============================================================================
// VALIDATOR REGISTRY
// ============================================================================

/**
 * Centralized registry of all validators for easy access
 */
export const validators = {
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  review: reviewSchema,
  comment: commentSchema,
  upload: uploadSchema,
  report: reportSchema,
  signup: signupSchema,
  login: loginSchema,
  passwordResetRequest: passwordResetRequestSchema,
  passwordResetConfirm: passwordResetConfirmSchema,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely validate password strength without throwing
 * Returns detailed feedback about what's missing
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  feedback: string[];
} {
  const feedback: string[] = [];

  if (password.length < PASSWORD_POLICY.minLength) {
    feedback.push(
      `Password must be at least ${PASSWORD_POLICY.minLength} characters (currently ${password.length})`
    );
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    feedback.push('Add at least one uppercase letter');
  }

  if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) {
    feedback.push('Add at least one number');
  }

  if (PASSWORD_POLICY.requireSpecialChars && !SPECIAL_CHAR_PATTERN.test(password)) {
    feedback.push('Add at least one special character (!@#$%^&* etc.)');
  }

  if (PASSWORD_POLICY.preventCommonPasswords && COMMON_PASSWORDS.includes(password.toLowerCase())) {
    feedback.push('This password is too common. Choose a more unique password');
  }

  return {
    isValid: feedback.length === 0,
    feedback,
  };
}

/**
 * Check if email is already taken (placeholder for DB check)
 * This should be extended to query actual database
 */
export async function isEmailAvailable(_email: string): Promise<boolean> {
  // TODO: Check against database
  // const existing = await db.users.findUnique({ where: { email } });
  // return !existing;
  return true;
}

/**
 * Check if username is already taken (placeholder for DB check)
 * This should be extended to query actual database
 */
export async function isUsernameAvailable(_username: string): Promise<boolean> {
  // TODO: Check against database
  // const existing = await db.users.findUnique({ where: { username } });
  // return !existing;
  return true;
}
