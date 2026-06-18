import { describe, it, expect } from 'vitest';
import {
  usernameSchema,
  emailSchema,
  passwordSchema,
  reviewSchema,
  commentSchema,
  uploadSchema,
  reportSchema,
  signupSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  parseInput,
  validatePasswordStrength,
} from '@/lib/security/input-validator';

// ============================================================================
// USERNAME SCHEMA TESTS
// ============================================================================

describe('usernameSchema', () => {
  it('should accept valid usernames', () => {
    const validCases = ['john_doe', 'user123', 'a_b_c', 'test_1', 'me123'];

    validCases.forEach((username) => {
      expect(usernameSchema.safeParse(username)).toMatchObject({ success: true });
    });
  });

  it('should reject usernames that are too short', () => {
    expect(usernameSchema.safeParse('ab')).toMatchObject({ success: false });
    expect(usernameSchema.safeParse('a')).toMatchObject({ success: false });
  });

  it('should reject usernames with uppercase letters', () => {
    expect(usernameSchema.safeParse('John_Doe')).toMatchObject({ success: false });
    expect(usernameSchema.safeParse('USERNAME')).toMatchObject({ success: false });
  });

  it('should reject usernames with invalid characters', () => {
    expect(usernameSchema.safeParse('user@name')).toMatchObject({ success: false });
    expect(usernameSchema.safeParse('user-name')).toMatchObject({ success: false });
    expect(usernameSchema.safeParse('user name')).toMatchObject({ success: false });
    expect(usernameSchema.safeParse('user.name')).toMatchObject({ success: false });
  });

  it('should reject too long usernames', () => {
    const longName = 'a'.repeat(21);
    expect(usernameSchema.safeParse(longName)).toMatchObject({ success: false });
  });

  it('should accept edge case valid usernames', () => {
    expect(usernameSchema.safeParse('abc')).toMatchObject({ success: true });
    expect(usernameSchema.safeParse('a'.repeat(20))).toMatchObject({ success: true });
    expect(usernameSchema.safeParse('123_456')).toMatchObject({ success: true });
  });
});

// ============================================================================
// EMAIL SCHEMA TESTS
// ============================================================================

describe('emailSchema', () => {
  it('should accept valid emails', () => {
    const validEmails = [
      'user@example.com',
      'john.doe@example.com',
      'john.doe+test@example.co.uk',
      'test123@sub.domain.com',
    ];

    validEmails.forEach((email) => {
      expect(emailSchema.safeParse(email)).toMatchObject({ success: true });
    });
  });

  it('should reject invalid emails', () => {
    const invalidEmails = [
      'not-an-email',
      'user@',
      '@example.com',
      'user@example',
      'user name@example.com',
    ];

    invalidEmails.forEach((email) => {
      expect(emailSchema.safeParse(email)).toMatchObject({ success: false });
    });
  });

  it('should normalize to lowercase', () => {
    const result = emailSchema.safeParse('User@Example.COM');
    expect(result.success && result.data).toBe('user@example.com');
  });

  it('should handle edge case emails', () => {
    expect(emailSchema.safeParse('a@b.co')).toMatchObject({ success: true });
    expect(emailSchema.safeParse('1@2.3')).toMatchObject({ success: false });
  });
});

// ============================================================================
// PASSWORD SCHEMA TESTS
// ============================================================================

describe('passwordSchema', () => {
  it('should accept valid passwords', () => {
    const validPasswords = [
      'SecurePass123!',
      'MyPassword@2024',
      'TestPass#999',
      'Complex$Pass123',
    ];

    validPasswords.forEach((pwd) => {
      expect(passwordSchema.safeParse(pwd)).toMatchObject({ success: true });
    });
  });

  it('should reject passwords without uppercase', () => {
    expect(passwordSchema.safeParse('securepass123!')).toMatchObject({ success: false });
    expect(passwordSchema.safeParse('lowercase1!')).toMatchObject({ success: false });
  });

  it('should reject passwords without numbers', () => {
    expect(passwordSchema.safeParse('SecurePass!')).toMatchObject({ success: false });
    expect(passwordSchema.safeParse('NoNumber@Here')).toMatchObject({ success: false });
  });

  it('should reject passwords without special characters', () => {
    expect(passwordSchema.safeParse('SecurePass123')).toMatchObject({ success: false });
    expect(passwordSchema.safeParse('NoSpecial1234')).toMatchObject({ success: false });
  });

  it('should reject passwords shorter than 12 characters', () => {
    expect(passwordSchema.safeParse('Short1!')).toMatchObject({ success: false });
    expect(passwordSchema.safeParse('Pass1!')).toMatchObject({ success: false });
  });

  it('should reject common passwords', () => {
    const commonPasswords = [
      'password123!',
      'admin@123',
      'welcome@1',
      'letmein@1',
      'baseball@1',
      'dragon@123',
      'passw0rd!',
    ];

    commonPasswords.forEach((pwd) => {
      expect(passwordSchema.safeParse(pwd)).toMatchObject({ success: false });
    });
  });

  it('should provide helpful error messages', () => {
    const result = passwordSchema.safeParse('lowercase');
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message);
      expect(errors.some((msg) => msg.includes('uppercase'))).toBe(true);
      expect(errors.some((msg) => msg.includes('number'))).toBe(true);
      expect(errors.some((msg) => msg.includes('special character'))).toBe(true);
    }
  });
});

// ============================================================================
// REVIEW SCHEMA TESTS
// ============================================================================

describe('reviewSchema', () => {
  const validReview = {
    venue_id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Great coffee and service',
    body: 'This place has the best coffee in the area. Highly recommend for a morning gossoko break.',
    coffee_strength_rating: 5,
    feed_size_rating: 4,
    bang_for_buck_rating: 5,
    speed_rating: 5,
    ute_parking_rating: 3,
    early_open_rating: 5,
    service_rating: 5,
  };

  it('should accept valid reviews', () => {
    expect(reviewSchema.safeParse(validReview)).toMatchObject({ success: true });
  });

  it('should accept reviews with minimum valid ratings', () => {
    const minReview = {
      ...validReview,
      coffee_strength_rating: 1,
      feed_size_rating: 1,
      bang_for_buck_rating: 1,
      speed_rating: 1,
      ute_parking_rating: 1,
      early_open_rating: 1,
      service_rating: 1,
    };
    expect(reviewSchema.safeParse(minReview)).toMatchObject({ success: true });
  });

  it('should reject reviews with invalid ratings', () => {
    const invalidRatings = [
      { ...validReview, coffee_strength_rating: 0 },
      { ...validReview, coffee_strength_rating: 6 },
      { ...validReview, coffee_strength_rating: -1 },
      { ...validReview, feed_size_rating: 7 },
    ];

    invalidRatings.forEach((review) => {
      expect(reviewSchema.safeParse(review)).toMatchObject({ success: false });
    });
  });

  it('should reject ratings that are not whole numbers', () => {
    expect(
      reviewSchema.safeParse({
        ...validReview,
        coffee_strength_rating: 2.5,
      })
    ).toMatchObject({ success: false });
  });

  it('should reject reviews with short titles', () => {
    const tooShort = { ...validReview, title: 'Good' };
    expect(reviewSchema.safeParse(tooShort)).toMatchObject({ success: false });
  });

  it('should reject reviews with long titles', () => {
    const tooLong = { ...validReview, title: 'a'.repeat(101) };
    expect(reviewSchema.safeParse(tooLong)).toMatchObject({ success: false });
  });

  it('should reject reviews with short bodies', () => {
    const tooShort = { ...validReview, body: 'Too short' };
    expect(reviewSchema.safeParse(tooShort)).toMatchObject({ success: false });
  });

  it('should reject reviews with long bodies', () => {
    const tooLong = { ...validReview, body: 'a'.repeat(2001) };
    expect(reviewSchema.safeParse(tooLong)).toMatchObject({ success: false });
  });

  it('should reject invalid venue UUIDs', () => {
    const invalid = { ...validReview, venue_id: 'not-a-uuid' };
    expect(reviewSchema.safeParse(invalid)).toMatchObject({ success: false });
  });

  it('should reject missing required fields', () => {
    expect(reviewSchema.safeParse({ title: validReview.title })).toMatchObject({
      success: false,
    });
  });
});

// ============================================================================
// COMMENT SCHEMA TESTS
// ============================================================================

describe('commentSchema', () => {
  const validComment = {
    review_id: '123e4567-e89b-12d3-a456-426614174000',
    body: 'Great feedback! Thanks for sharing.',
  };

  it('should accept valid comments', () => {
    expect(commentSchema.safeParse(validComment)).toMatchObject({ success: true });
  });

  it('should accept comments with parent reference', () => {
    const withParent = {
      ...validComment,
      parent_comment_id: '123e4567-e89b-12d3-a456-426614174001',
    };
    expect(commentSchema.safeParse(withParent)).toMatchObject({ success: true });
  });

  it('should reject short comments', () => {
    const tooShort = { ...validComment, body: 'A' };
    expect(commentSchema.safeParse(tooShort)).toMatchObject({ success: false });
  });

  it('should reject long comments', () => {
    const tooLong = { ...validComment, body: 'a'.repeat(1001) };
    expect(commentSchema.safeParse(tooLong)).toMatchObject({ success: false });
  });

  it('should reject invalid parent comment IDs', () => {
    const invalid = {
      ...validComment,
      parent_comment_id: 'not-a-uuid',
    };
    expect(commentSchema.safeParse(invalid)).toMatchObject({ success: false });
  });

  it('should reject invalid review IDs', () => {
    const invalid = { ...validComment, review_id: 'invalid' };
    expect(commentSchema.safeParse(invalid)).toMatchObject({ success: false });
  });
});

// ============================================================================
// UPLOAD SCHEMA TESTS
// ============================================================================

describe('uploadSchema', () => {
  const validUpload = {
    filename: 'screenshot.png',
    filesize: 1024000,
    mimetype: 'image/png',
  };

  it('should accept valid uploads', () => {
    const validUploads = [
      { ...validUpload, mimetype: 'image/jpeg' },
      { ...validUpload, mimetype: 'image/webp' },
      { ...validUpload, mimetype: 'application/pdf' },
      { ...validUpload, mimetype: 'text/plain' },
    ];

    validUploads.forEach((upload) => {
      expect(uploadSchema.safeParse(upload)).toMatchObject({ success: true });
    });
  });

  it('should reject path traversal attempts in filenames', () => {
    const pathTraversals = [
      { ...validUpload, filename: '../../../etc/passwd' },
      { ...validUpload, filename: '..\\..\\windows\\system32' },
      { ...validUpload, filename: 'file..txt' },
    ];

    pathTraversals.forEach((upload) => {
      expect(uploadSchema.safeParse(upload)).toMatchObject({ success: false });
    });
  });

  it('should reject zero-byte files', () => {
    expect(uploadSchema.safeParse({ ...validUpload, filesize: 0 })).toMatchObject({
      success: false,
    });
  });

  it('should reject negative file sizes', () => {
    expect(uploadSchema.safeParse({ ...validUpload, filesize: -1 })).toMatchObject({
      success: false,
    });
  });

  it('should reject files exceeding max size', () => {
    // Max file size is 10MB (10485760 bytes)
    expect(uploadSchema.safeParse({ ...validUpload, filesize: 10485761 })).toMatchObject({
      success: false,
    });
  });

  it('should reject unsupported file types', () => {
    const unsupported = [
      { ...validUpload, mimetype: 'application/exe' },
      { ...validUpload, mimetype: 'text/html' },
      { ...validUpload, mimetype: 'application/javascript' },
    ];

    unsupported.forEach((upload) => {
      expect(uploadSchema.safeParse(upload)).toMatchObject({ success: false });
    });
  });

  it('should reject missing filename', () => {
    expect(uploadSchema.safeParse({ filesize: 1024, mimetype: 'image/png' })).toMatchObject({
      success: false,
    });
  });

  it('should reject too long filenames', () => {
    expect(
      uploadSchema.safeParse({
        ...validUpload,
        filename: 'a'.repeat(256),
      })
    ).toMatchObject({ success: false });
  });
});

// ============================================================================
// REPORT SCHEMA TESTS
// ============================================================================

describe('reportSchema', () => {
  const validReport = {
    reported_by: '123e4567-e89b-12d3-a456-426614174000',
    reportable_type: 'review' as const,
    reportable_id: '123e4567-e89b-12d3-a456-426614174001',
    report_type: 'spam' as const,
    reason: 'This review contains promotional spam and repeated links.',
  };

  it('should accept valid reports', () => {
    expect(reportSchema.safeParse(validReport)).toMatchObject({ success: true });
  });

  it('should support all reportable types', () => {
    const types = ['review', 'comment', 'venue', 'user'] as const;

    types.forEach((type) => {
      expect(
        reportSchema.safeParse({
          ...validReport,
          reportable_type: type,
        })
      ).toMatchObject({ success: true });
    });
  });

  it('should support all report types', () => {
    const reportTypes = ['spam', 'offensive', 'inappropriate_image', 'fake_venue', 'other'] as const;

    reportTypes.forEach((type) => {
      expect(
        reportSchema.safeParse({
          ...validReport,
          report_type: type,
        })
      ).toMatchObject({ success: true });
    });
  });

  it('should reject invalid reportable types', () => {
    expect(
      reportSchema.safeParse({
        ...validReport,
        reportable_type: 'invalid',
      })
    ).toMatchObject({ success: false });
  });

  it('should reject invalid report types', () => {
    expect(
      reportSchema.safeParse({
        ...validReport,
        report_type: 'invalid',
      })
    ).toMatchObject({ success: false });
  });

  it('should reject short reasons', () => {
    expect(
      reportSchema.safeParse({
        ...validReport,
        reason: 'Bad',
      })
    ).toMatchObject({ success: false });
  });

  it('should reject long reasons', () => {
    expect(
      reportSchema.safeParse({
        ...validReport,
        reason: 'a'.repeat(501),
      })
    ).toMatchObject({ success: false });
  });

  it('should reject invalid UUIDs', () => {
    const invalidIds = [
      { ...validReport, reported_by: 'not-uuid' },
      { ...validReport, reportable_id: 'not-uuid' },
    ];

    invalidIds.forEach((report) => {
      expect(reportSchema.safeParse(report)).toMatchObject({ success: false });
    });
  });
});

// ============================================================================
// SIGNUP SCHEMA TESTS
// ============================================================================

describe('signupSchema', () => {
  const validSignup = {
    email: 'newuser@example.com',
    username: 'john_doe',
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
  };

  it('should accept valid signup data', () => {
    expect(signupSchema.safeParse(validSignup)).toMatchObject({ success: true });
  });

  it('should reject mismatched passwords', () => {
    const mismatched = {
      ...validSignup,
      confirmPassword: 'DifferentPass123!',
    };
    expect(signupSchema.safeParse(mismatched)).toMatchObject({ success: false });
  });

  it('should reject invalid emails', () => {
    const invalidEmail = {
      ...validSignup,
      email: 'not-an-email',
    };
    expect(signupSchema.safeParse(invalidEmail)).toMatchObject({ success: false });
  });

  it('should reject invalid usernames', () => {
    const invalidUsername = {
      ...validSignup,
      username: 'InvalidName',
    };
    expect(signupSchema.safeParse(invalidUsername)).toMatchObject({ success: false });
  });

  it('should reject weak passwords', () => {
    const weakPassword = {
      ...validSignup,
      password: 'weak',
      confirmPassword: 'weak',
    };
    expect(signupSchema.safeParse(weakPassword)).toMatchObject({ success: false });
  });
});

// ============================================================================
// LOGIN SCHEMA TESTS
// ============================================================================

describe('loginSchema', () => {
  const validLogin = {
    email: 'user@example.com',
    password: 'SecurePass123!',
  };

  it('should accept valid login data', () => {
    expect(loginSchema.safeParse(validLogin)).toMatchObject({ success: true });
  });

  it('should reject missing email', () => {
    expect(loginSchema.safeParse({ password: validLogin.password })).toMatchObject({
      success: false,
    });
  });

  it('should reject missing password', () => {
    expect(loginSchema.safeParse({ email: validLogin.email })).toMatchObject({
      success: false,
    });
  });

  it('should reject empty password', () => {
    expect(loginSchema.safeParse({ email: validLogin.email, password: '' })).toMatchObject({
      success: false,
    });
  });

  it('should reject invalid email format', () => {
    expect(
      loginSchema.safeParse({
        email: 'not-an-email',
        password: validLogin.password,
      })
    ).toMatchObject({ success: false });
  });
});

// ============================================================================
// PASSWORD RESET SCHEMA TESTS
// ============================================================================

describe('passwordResetRequestSchema', () => {
  it('should accept valid email', () => {
    expect(
      passwordResetRequestSchema.safeParse({
        email: 'user@example.com',
      })
    ).toMatchObject({ success: true });
  });

  it('should reject invalid email', () => {
    expect(
      passwordResetRequestSchema.safeParse({
        email: 'not-an-email',
      })
    ).toMatchObject({ success: false });
  });
});

describe('passwordResetConfirmSchema', () => {
  const validReset = {
    token: 'valid_reset_token_123',
    password: 'NewPassword123!',
    confirmPassword: 'NewPassword123!',
  };

  it('should accept valid reset data', () => {
    expect(passwordResetConfirmSchema.safeParse(validReset)).toMatchObject({
      success: true,
    });
  });

  it('should reject mismatched passwords', () => {
    expect(
      passwordResetConfirmSchema.safeParse({
        ...validReset,
        confirmPassword: 'Different123!',
      })
    ).toMatchObject({ success: false });
  });

  it('should reject missing token', () => {
    expect(
      passwordResetConfirmSchema.safeParse({
        password: validReset.password,
        confirmPassword: validReset.confirmPassword,
      })
    ).toMatchObject({ success: false });
  });

  it('should reject weak password', () => {
    expect(
      passwordResetConfirmSchema.safeParse({
        token: validReset.token,
        password: 'weak',
        confirmPassword: 'weak',
      })
    ).toMatchObject({ success: false });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('parseInput helper', () => {
  it('should return success with data on valid input', () => {
    const result = parseInput(usernameSchema, 'valid_user');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('valid_user');
    }
  });

  it('should return errors on invalid input', () => {
    const result = parseInput(usernameSchema, 'INVALID');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBeTruthy();
    }
  });

  it('should return multiple errors for complex schemas', () => {
    const result = parseInput(reviewSchema, {
      venue_id: 'invalid',
      title: 'Bad',
      body: 'No',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors[0].field).toBeTruthy();
    }
  });

  it('should use field names in error paths', () => {
    const result = parseInput(signupSchema, {
      email: 'invalid-email',
      username: 'valid_user',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'email')).toBe(true);
    }
  });
});

describe('validatePasswordStrength utility', () => {
  it('should return feedback for weak passwords', () => {
    const result = validatePasswordStrength('weak');
    expect(result.isValid).toBe(false);
    expect(result.feedback.length).toBeGreaterThan(0);
    expect(result.feedback.some((f) => f.includes('uppercase'))).toBe(true);
    expect(result.feedback.some((f) => f.includes('number'))).toBe(true);
    expect(result.feedback.some((f) => f.includes('special'))).toBe(true);
  });

  it('should validate strong passwords', () => {
    const result = validatePasswordStrength('SecurePass123!');
    expect(result.isValid).toBe(true);
    expect(result.feedback).toHaveLength(0);
  });

  it('should provide specific feedback for each missing requirement', () => {
    const result = validatePasswordStrength('NONUM');
    expect(result.feedback.some((f) => f.includes('12 characters'))).toBe(true);
    expect(result.feedback.some((f) => f.includes('number'))).toBe(true);
    expect(result.feedback.some((f) => f.includes('special character'))).toBe(true);
  });

  it('should warn about common passwords', () => {
    const result = validatePasswordStrength('password123!');
    expect(result.isValid).toBe(false);
    expect(result.feedback.some((f) => f.includes('common'))).toBe(true);
  });
});
