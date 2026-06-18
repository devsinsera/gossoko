// src/config/security.ts
// Foundational security configuration and constants for Gossoko
// All security thresholds, policies, and restrictions defined here

// Rate limiting configuration (sliding window)
export const RATE_LIMITS = {
  api: {
    max: 60,                  // General API requests
    windowMs: 60000,          // per 1 minute
  },
  auth: {
    max: 5,                   // Login/signup attempts
    windowMs: 60000,          // per 1 minute
  },
  uploads: {
    max: 10,                  // File uploads
    windowMs: 60000,          // per 1 minute
  },
  contentCreation: {
    max: 20,                  // Reviews/comments
    windowMs: 60000,          // per 1 minute
  },
  reportSubmission: {
    max: 30,                  // Report abuse
    windowMs: 60000,          // per 1 minute
  },
} as const;

// File upload restrictions
export const UPLOAD_LIMITS = {
  maxFileSize: 10 * 1024 * 1024,  // 10MB
  maxImageSize: 5 * 1024 * 1024,   // 5MB for images
  maxFiles: 10,                     // Max files per request
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedDocTypes: ['application/pdf', 'text/plain'],
} as const;

// Image restrictions
export const IMAGE_RESTRICTIONS = {
  maxDimensions: { width: 4000, height: 4000 },
  minDimensions: { width: 100, height: 100 },
  maxAspectRatio: 4,  // Width can't be 4x height
  qualityLevel: 80,   // JPEG quality 0-100
} as const;

// Password policy
export const PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 15,
  sessionTimeoutMinutes: 60,
} as const;

// Security headers
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.sentry.io;",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
} as const;

// CORS configuration
export const CORS_CONFIG = {
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowCredentials: true,
  maxAge: 3600,
} as const;

// Abuse detection thresholds
export const ABUSE_THRESHOLDS = {
  reportedCountBeforeShadowBan: 5,
  reportedCountBeforeHide: 10,
  capsRatio: 0.7,              // > 70% caps = suspicious
  repeatingCharsRatio: 0.3,    // > 30% repeating = suspicious
  urlDensity: 0.2,             // > 20% URLs in text = suspicious
  profanityThreshold: 3,       // > 3 swears = flag content
  accountCreationRateLimit: 5, // Max accounts per IP per hour
  failedLoginAttempts: 5,      // Lock account after N failed attempts
  suspiciousActivityScore: 0.8, // Alert if score > 0.8 (0-1)
} as const;

// Monitoring & alerting configuration
export const MONITORING = {
  enableSentryIntegration: process.env.SENTRY_DSN ? true : false,
  enableAuditLogging: true,
  enableSuspiciousActivityAlerts: true,
  alertingThresholds: {
    failedLoginAttempts: 10,    // Alert if > 10 failed logins in 1 hour
    unusualActivityScore: 0.8,  // Alert if activity score > 0.8
    bulkDataAccess: 1000,       // Alert if > 1000 records accessed in 1 min
  },
} as const;

// Type exports for strict typing
export type RateLimit = keyof typeof RATE_LIMITS;
export type UploadLimit = keyof typeof UPLOAD_LIMITS;
export type ImageRestriction = keyof typeof IMAGE_RESTRICTIONS;
export type PasswordPolicyKey = keyof typeof PASSWORD_POLICY;
export type SecurityHeaderKey = keyof typeof SECURITY_HEADERS;
export type AbuseThresholdKey = keyof typeof ABUSE_THRESHOLDS;
