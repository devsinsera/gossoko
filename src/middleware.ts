// Middleware: Supabase session refresh + rate limiting + security headers.
//
// Order matters:
//   1. Supabase session refresh runs first so subsequent code (and the page
//      it ultimately lands on) sees a fresh auth.uid().
//   2. Rate limiting on /api/* + /auth/* per RATE_LIMITS config.
//   3. Security headers applied to every response.
//
// The matcher covers all page + API routes and excludes static assets.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimiter } from '@/lib/security/rate-limiter';
import { getSecurityHeaders } from '@/lib/security/headers-config';
import { RATE_LIMITS } from '@/config/security';

function getUserIdentifier(request: NextRequest): string {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf-8')
          );
          if (payload.user_id) return `user:${payload.user_id}`;
          if (payload.sub) return `user:${payload.sub}`;
          if (payload.oid) return `user:${payload.oid}`;
        } catch (decodeError) {
          console.debug('Failed to decode JWT payload:', decodeError);
        }
      }
    } catch (error) {
      console.debug('Failed to extract user from auth header:', error);
    }
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'anonymous';
  return `ip:${ip}`;
}

function getRateLimitType(pathname: string): keyof typeof RATE_LIMITS | null {
  if (pathname.startsWith('/api/auth')) return 'auth';
  if (pathname.startsWith('/api/upload')) return 'uploads';
  if (pathname.startsWith('/api/reviews') || pathname.startsWith('/api/comments')) {
    return 'contentCreation';
  }
  if (pathname.startsWith('/api/reports')) return 'reportSubmission';
  if (pathname.startsWith('/api')) return 'api';
  return null;
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export async function middleware(request: NextRequest) {
  // --- 1. Supabase session refresh ----------------------------------------
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  // Touching getUser() forces refresh-token rotation when needed.
  await supabase.auth.getUser();

  // --- 2. Rate limiting ---------------------------------------------------
  const { pathname } = request.nextUrl;
  const rateLimitType = getRateLimitType(pathname);

  if (rateLimitType) {
    const identifier = getUserIdentifier(request);
    const result = await rateLimiter.checkLimit(rateLimitType, identifier);

    response.headers.set('X-RateLimit-Limit', RATE_LIMITS[rateLimitType].max.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      // Carry Supabase's session-refresh cookies across into the 429 response.
      const errorResponse = new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please retry after ${result.retryAfter || 60} seconds.`,
          retryAfter: result.retryAfter,
          resetAt: result.resetAt.toISOString(),
        }),
        { status: 429, headers: response.headers },
      );
      errorResponse.headers.set('Retry-After', result.retryAfter?.toString() || '60');
      for (const cookie of response.cookies.getAll()) {
        errorResponse.cookies.set(cookie);
      }
      return applySecurityHeaders(errorResponse);
    }
  }

  // --- 3. Security headers on the final response -------------------------
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    // Run on every request EXCEPT Next.js internals and static assets.
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
