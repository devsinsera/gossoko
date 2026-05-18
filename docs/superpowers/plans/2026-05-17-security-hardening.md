# Gossoko Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement enterprise-grade security for Gossoko protecting against XSS, CSRF, SQL injection, spam, fake accounts, abusive uploads, API abuse, scraping, and bot attacks.

**Architecture:** Multi-layered defense with middleware for rate limiting and secure headers, validation schemas for all inputs, content scanning for uploads, suspicious activity detection with automated alerting, and comprehensive audit logging for all security events.

**Tech Stack:** Next.js middleware, Zod schemas, Sharp for image processing, Redis for rate limiting, Supabase RLS, Sentry for monitoring.

---

## Security Layers

1. **Rate Limiting** - Prevent brute force, DoS, API abuse
2. **Input Validation** - Zod schemas for all user inputs
3. **Upload Security** - File type, size, content validation
4. **Image Processing** - Sharp-based optimization + restrictions
5. **Auth Hardening** - Password policy, account lockout, session management
6. **Secure Headers** - CSP, X-Frame-Options, HSTS
7. **CORS & API Protection** - Origin validation, request signing
8. **XSS/CSRF Prevention** - Content sanitization, CSRF tokens
9. **Spam & Abuse Detection** - Profanity filter, pattern detection
10. **Fake Account Detection** - Behavioral analysis, risk scoring
11. **Suspicious Activity Monitoring** - Anomaly detection, alerting
12. **Audit Logging** - All security events tracked
13. **Abuse Detection** - Real-time content flagging
14. **Sentry Integration** - Error monitoring & security alerts
15. **Security Checklist** - Production readiness verification

---

## Task Breakdown

### Task 1: Security Configuration & Constants
- Create: `src/config/security.ts`
- Create: `.env.security`
- Define rate limits, file upload restrictions, password policy, security headers

### Task 2: Rate Limiting with Redis
- Create: `src/lib/security/rate-limiter.ts`
- Create: `tests/security/rate-limit.test.ts`
- Modify: `src/middleware.ts` - Add rate limiting checks
- Sliding window rate limiter, per-endpoint limits

### Task 3: Input Validation Schemas
- Create: `src/lib/security/input-validator.ts`
- Create: `tests/security/input-validation.test.ts`
- Zod schemas for username, email, password, reviews, comments, uploads, reports

### Task 4: Content Sanitization & XSS Prevention
- Create: `src/lib/security/sanitizer.ts`
- Create: `tests/security/sanitizer.test.ts`
- HTML sanitization, markdown safety, script injection prevention

### Task 5: Upload Validation & File Restrictions
- Create: `src/lib/security/upload-validator.ts`
- Create: `tests/security/upload-validator.test.ts`
- File type validation, size limits, malware scanning hooks

### Task 6: Image Processing & Restrictions
- Create: `src/lib/security/image-processor.ts`
- Create: `tests/security/image-processor.test.ts`
- Sharp-based image optimization, EXIF stripping, dimension checks

### Task 7: Auth Hardening
- Create: `src/lib/security/auth-hardener.ts`
- Modify: `src/server/auth-actions.ts`
- Password policy enforcement, account lockout, session timeout, 2FA prep

### Task 8: Secure Headers Middleware
- Create: `src/lib/security/headers-config.ts`
- Modify: `src/middleware.ts` - Add security headers
- CSP, HSTS, X-Frame-Options, Referrer-Policy, etc.

### Task 9: CORS & API Protection
- Create: `src/lib/security/cors-config.ts`
- Modify: `src/middleware.ts` - Add CORS validation
- Origin whitelist, preflight handling, credential validation

### Task 10: CSRF Protection
- Create: `src/lib/security/csrf-protection.ts`
- Create: `tests/security/csrf.test.ts`
- Token generation, validation, SameSite cookies

### Task 11: Profanity Filter & Spam Detection
- Create: `src/lib/security/profanity-filter.ts`
- Create: `src/lib/security/spam-detector.ts`
- Create: `tests/security/spam-detection.test.ts`
- Profanity list, spam pattern detection, caps/repeat detection

### Task 12: Fake Account Detection
- Create: `src/lib/security/account-detector.ts`
- Create: `tests/security/account-detection.test.ts`
- Risk scoring, behavioral patterns, email/IP analysis

### Task 13: Suspicious Activity Monitoring
- Create: `src/lib/security/activity-monitor.ts`
- Create: `src/lib/security/anomaly-detector.ts`
- Real-time monitoring, scoring, alerting logic

### Task 14: Comprehensive Audit Logging
- Create: `src/server/audit-logger.ts`
- Modify: Database schema for audit events
- All security events logged with context

### Task 15: Sentry Integration & Security Alerts
- Create: `src/lib/monitoring/sentry-config.ts`
- Modify: `src/middleware.ts` - Add error tracking
- Security event alerts, error monitoring

---

## Execution Notes

- Each task is independent but builds on previous security layer
- All tasks have comprehensive tests
- Security assumptions should be documented
- Production checklist in Task 15 validates all layers
- No task batching - each has separate review checkpoint

