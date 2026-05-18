// src/middleware.ts
// Middleware for security headers, rate limiting, and request routing
// Processes all API requests and enforces security policies

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/security/rate-limiter';
import { getSecurityHeaders } from '@/lib/security/headers-config';
import { RATE_LIMITS } from '@/config/security';

/**
 * Extract user identifier from request
 * Prioritizes authenticated user ID, falls back to IP address
 * Uses JWT payload extraction for user ID (no hashing needed - JWT is already unique)
 */
function getUserIdentifier(request: NextRequest): string {
  // Try to extract user ID from auth header (JWT)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    try {
      // Extract token from "Bearer <token>" format
      const token = authHeader.replace('Bearer ', '');
      const parts = token.split('.');

      // JWT format: header.payload.signature
      if (parts.length === 3) {
        try {
          // Decode JWT payload (base64url decode)
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf-8')
          );

          // Use user_id, sub, or oid claim as unique identifier
          if (payload.user_id) return `user:${payload.user_id}`;
          if (payload.sub) return `user:${payload.sub}`;
          if (payload.oid) return `user:${payload.oid}`; // Microsoft Azure claim
        } catch (decodeError) {
          console.debug('Failed to decode JWT payload:', decodeError);
        }
      }
    } catch (error) {
      console.debug('Failed to extract user from auth header:', error);
    }
  }

  // Fall back to IP address
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'anonymous';

  return `ip:${ip}`;
}

/**
 * Determine rate limit type from request path
 */
function getRateLimitType(pathname: string): keyof typeof RATE_LIMITS | null {
  if (pathname.startsWith('/api/auth')) {
    return 'auth';
  }
  if (pathname.startsWith('/api/upload')) {
    return 'uploads';
  }
  if (
    pathname.startsWith('/api/reviews') ||
    pathname.startsWith('/api/comments')
  ) {
    return 'contentCreation';
  }
  if (pathname.startsWith('/api/reports')) {
    return 'reportSubmission';
  }
  if (pathname.startsWith('/api')) {
    return 'api';
  }

  return null;
}

/**
 * Apply security headers to response
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Determine if this request needs rate limiting
  const rateLimitType = getRateLimitType(pathname);

  // Check rate limit if applicable
  if (rateLimitType) {
    const identifier = getUserIdentifier(request);
    const result = await rateLimiter.checkLimit(rateLimitType, identifier);

    // Add rate limit headers to response
    const response = NextResponse.next();
    response.headers.set(
      'X-RateLimit-Limit',
      RATE_LIMITS[rateLimitType].max.toString()
    );
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

    // If limit exceeded, return 429
    if (!result.allowed) {
      response.headers.set(
        'Retry-After',
        result.retryAfter?.toString() || '60'
      );

      const errorResponse = new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please retry after ${result.retryAfter || 60} seconds.`,
          retryAfter: result.retryAfter,
          resetAt: result.resetAt.toISOString(),
        }),
        {
          status: 429,
          headers: response.headers,
        }
      );

      return applySecurityHeaders(errorResponse);
    }

    return applySecurityHeaders(response);
  }

  // For non-rate-limited requests, still apply security headers
  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

/**
 * Configure which routes this middleware applies to
 */
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match auth routes if not under /api
    '/auth/:path*',
  ],
};
