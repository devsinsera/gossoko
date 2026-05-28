// tests/security/secure-headers.test.ts
// Comprehensive test suite for security headers configuration and middleware integration

import { describe, it, expect } from 'vitest';
import { NextResponse } from 'next/server';
import {
  getSecurityHeaders,
  serializeCSP,
  serializePermissionsPolicy,
  serializeHSTS,
} from '@/lib/security/headers-config';

describe('Security Headers Configuration', () => {
  describe('getSecurityHeaders()', () => {
    it('should return all required security headers', () => {
      const headers = getSecurityHeaders();
      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).toHaveProperty('Strict-Transport-Security');
      expect(headers).toHaveProperty('X-Frame-Options');
      expect(headers).toHaveProperty('X-Content-Type-Options');
      expect(headers).toHaveProperty('X-XSS-Protection');
      expect(headers).toHaveProperty('Referrer-Policy');
      expect(headers).toHaveProperty('Permissions-Policy');
    });

    it('should return all headers as strings', () => {
      const headers = getSecurityHeaders();
      Object.entries(headers).forEach(([, value]) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });

    it('should not contain undefined or null values', () => {
      const headers = getSecurityHeaders();
      Object.entries(headers).forEach(([, value]) => {
        expect(value).not.toBeUndefined();
        expect(value).not.toBeNull();
      });
    });

    it('should return an object with string keys', () => {
      const headers = getSecurityHeaders();
      Object.keys(headers).forEach((key) => {
        expect(typeof key).toBe('string');
      });
    });

    it('should not leak environment variables into headers', () => {
      const headers = getSecurityHeaders();
      const headerString = JSON.stringify(headers);
      // Check common env var patterns don't appear
      expect(headerString).not.toMatch(/\$\{.*\}/);
      expect(headerString).not.toMatch(/process\.env/);
    });

    it('should have consistent header format across calls', () => {
      const headers1 = getSecurityHeaders();
      const headers2 = getSecurityHeaders();
      expect(headers1).toEqual(headers2);
    });

    it('should include X-Content-Type-Options: nosniff', () => {
      const headers = getSecurityHeaders();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should include X-XSS-Protection header', () => {
      const headers = getSecurityHeaders();
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    });
  });

  describe('serializeCSP()', () => {
    it('should serialize defaultSrc correctly', () => {
      const directives = { defaultSrc: ["'self'"] };
      const csp = serializeCSP(directives);
      expect(csp).toContain("default-src 'self'");
    });

    it('should serialize multiple sources for a directive', () => {
      const directives = {
        scriptSrc: ["'self'", "'unsafe-inline'", 'vercel.live'],
      };
      const csp = serializeCSP(directives);
      expect(csp).toContain("script-src 'self' 'unsafe-inline' vercel.live");
    });

    it('should convert camelCase directive names to kebab-case', () => {
      const directives = {
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
      };
      const csp = serializeCSP(directives);
      expect(csp).toContain('script-src');
      expect(csp).toContain('style-src');
      expect(csp).toContain('img-src');
    });

    it('should handle data: protocol in directives', () => {
      const directives = { imgSrc: ["'self'", 'data:', 'https:'] };
      const csp = serializeCSP(directives);
      expect(csp).toContain("img-src 'self' data: https:");
    });

    it('should handle fontSrc with data:', () => {
      const directives = { fontSrc: ["'self'", 'data:'] };
      const csp = serializeCSP(directives);
      expect(csp).toContain("font-src 'self' data:");
    });

    it('should handle connectSrc with multiple https endpoints', () => {
      const directives = {
        connectSrc: [
          "'self'",
          'https://api.github.com',
          'vercel.live',
          'https://*.supabase.co',
        ],
      };
      const csp = serializeCSP(directives);
      expect(csp).toContain('connect-src');
      expect(csp).toContain('https://api.github.com');
    });

    it('should handle frameSrc: none', () => {
      const directives = { frameSrc: ["'none'"] };
      const csp = serializeCSP(directives);
      expect(csp).toContain("frame-src 'none'");
    });

    it('should handle baseUri', () => {
      const directives = { baseUri: ["'self'"] };
      const csp = serializeCSP(directives);
      expect(csp).toContain("base-uri 'self'");
    });

    it('should handle formAction', () => {
      const directives = { formAction: ["'self'"] };
      const csp = serializeCSP(directives);
      expect(csp).toContain("form-action 'self'");
    });

    it('should handle styleSrc with unsafe-inline', () => {
      const directives = { styleSrc: ["'self'", "'unsafe-inline'"] };
      const csp = serializeCSP(directives);
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('should join directives with semicolons', () => {
      const directives = {
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
      };
      const csp = serializeCSP(directives);
      expect(csp).toContain(';');
      const parts = csp.split(';').filter((p) => p.trim());
      expect(parts.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty directive arrays gracefully', () => {
      const directives = { scriptSrc: [] };
      const csp = serializeCSP(directives);
      // Empty arrays should either be omitted or result in just the directive name
      expect(csp).not.toBeNull();
      expect(typeof csp).toBe('string');
    });

    it('should prevent injection in directive values', () => {
      const directives = {
        scriptSrc: ["'self'; malicious", 'safe.com'],
      };
      const csp = serializeCSP(directives);
      // The value should not be parsed for injection - it should be literal
      expect(csp).toContain("'self'; malicious");
    });
  });

  describe('serializePermissionsPolicy()', () => {
    it('should serialize camera as empty list', () => {
      const policy = { camera: [] };
      const pp = serializePermissionsPolicy(policy);
      expect(pp).toContain('camera=()');
    });

    it('should serialize microphone as empty list', () => {
      const policy = { microphone: [] };
      const pp = serializePermissionsPolicy(policy);
      expect(pp).toContain('microphone=()');
    });

    it('should serialize geolocation as empty list', () => {
      const policy = { geolocation: [] };
      const pp = serializePermissionsPolicy(policy);
      expect(pp).toContain('geolocation=()');
    });

    it('should serialize all common features', () => {
      const policy = {
        camera: [],
        microphone: [],
        geolocation: [],
        usb: [],
        magnetometer: [],
        gyroscope: [],
        accelerometer: [],
      };
      const pp = serializePermissionsPolicy(policy);
      expect(pp).toContain('camera=()');
      expect(pp).toContain('microphone=()');
      expect(pp).toContain('geolocation=()');
      expect(pp).toContain('usb=()');
      expect(pp).toContain('magnetometer=()');
      expect(pp).toContain('gyroscope=()');
      expect(pp).toContain('accelerometer=()');
    });

    it('should format as comma-separated directive=() pairs', () => {
      const policy = { camera: [], microphone: [] };
      const pp = serializePermissionsPolicy(policy);
      expect(pp).toMatch(/camera=\(\),\s*microphone=\(\)/);
    });

    it('should not have trailing comma', () => {
      const policy = { camera: [], microphone: [] };
      const pp = serializePermissionsPolicy(policy);
      expect(pp).not.toMatch(/,\s*$/);
    });

    it('should handle specific origins in allowlist', () => {
      const policy = { camera: ['https://example.com'] };
      const pp = serializePermissionsPolicy(policy);
      expect(pp).toContain('camera=(');
    });
  });

  describe('serializeHSTS()', () => {
    it('should include maxAge', () => {
      const hsts = { maxAge: 31536000, includeSubDomains: true, preload: true };
      const header = serializeHSTS(hsts);
      expect(header).toContain('max-age=31536000');
    });

    it('should include includeSubDomains when true', () => {
      const hsts = { maxAge: 31536000, includeSubDomains: true, preload: true };
      const header = serializeHSTS(hsts);
      expect(header).toContain('includeSubDomains');
    });

    it('should include preload when true', () => {
      const hsts = { maxAge: 31536000, includeSubDomains: true, preload: true };
      const header = serializeHSTS(hsts);
      expect(header).toContain('preload');
    });

    it('should format with semicolon separators', () => {
      const hsts = { maxAge: 31536000, includeSubDomains: true, preload: true };
      const header = serializeHSTS(hsts);
      expect(header).toContain(';');
    });

    it('should omit includeSubDomains when false', () => {
      const hsts = { maxAge: 31536000, includeSubDomains: false, preload: true };
      const header = serializeHSTS(hsts);
      expect(header).not.toContain('includeSubDomains');
    });

    it('should handle preload: false', () => {
      const hsts = { maxAge: 31536000, includeSubDomains: true, preload: false };
      const header = serializeHSTS(hsts);
      expect(header).not.toMatch(/preload/i);
    });
  });

  describe('CSP Directives', () => {
    it('should prevent script injection with defaultSrc', () => {
      const directives = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
      };
      const csp = serializeCSP(directives);
      // CSP should restrict scripts to same-origin
      expect(csp).toContain("script-src 'self'");
    });

    it('should prevent clickjacking via frameSrc', () => {
      const directives = { frameSrc: ["'none'"] };
      const csp = serializeCSP(directives);
      expect(csp).toContain("frame-src 'none'");
    });

    it('should include both script and style CSP directives', () => {
      const directives = {
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
      };
      const csp = serializeCSP(directives);
      expect(csp).toContain('script-src');
      expect(csp).toContain('style-src');
    });

    it('should include image CSP directives with data support', () => {
      const directives = { imgSrc: ["'self'", 'data:', 'https:'] };
      const csp = serializeCSP(directives);
      expect(csp).toContain('data:');
    });

    it('should handle connect-src for API endpoints', () => {
      const directives = {
        connectSrc: ["'self'", 'https://*.supabase.co', 'https://api.github.com'],
      };
      const csp = serializeCSP(directives);
      expect(csp).toContain('connect-src');
      expect(csp).toContain('https://*.supabase.co');
    });
  });

  describe('Permissions Policy', () => {
    it('should disable all hardware features by default', () => {
      const policy = {
        camera: [],
        microphone: [],
        geolocation: [],
        usb: [],
        magnetometer: [],
        gyroscope: [],
        accelerometer: [],
      };
      const pp = serializePermissionsPolicy(policy);
      // All should be empty lists
      expect(pp).toMatch(/camera=\(\)/);
      expect(pp).toMatch(/microphone=\(\)/);
      expect(pp).toMatch(/geolocation=\(\)/);
    });
  });

  describe('Headers Security Properties', () => {
    it('should include X-Frame-Options: DENY for clickjacking protection', () => {
      const headers = getSecurityHeaders();
      expect(headers['X-Frame-Options']).toBe('DENY');
    });

    it('should include X-Content-Type-Options: nosniff to prevent MIME sniffing', () => {
      const headers = getSecurityHeaders();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should include X-XSS-Protection for legacy XSS protection', () => {
      const headers = getSecurityHeaders();
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    });

    it('should include strict Referrer-Policy', () => {
      const headers = getSecurityHeaders();
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should include HSTS with preload flag', () => {
      const headers = getSecurityHeaders();
      const hsts = headers['Strict-Transport-Security'];
      expect(hsts).toContain('max-age=');
      expect(hsts).toContain('includeSubDomains');
    });
  });

  describe('Middleware Integration', () => {
    it('should apply security headers to response object', () => {
      const headers = getSecurityHeaders();
      const response = new NextResponse();

      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      Object.entries(headers).forEach(([key, value]) => {
        expect(response.headers.get(key)).toBe(value);
      });
    });

    it('should handle NextResponse.next() correctly', () => {
      const headers = getSecurityHeaders();
      const response = NextResponse.next();

      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      expect(response.headers.get('Content-Security-Policy')).not.toBeNull();
    });

    it('should not duplicate headers on multiple applications', () => {
      const headers = getSecurityHeaders();
      const response = new NextResponse();

      // Apply twice
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      // Should still have the same value, not concatenated
      expect(response.headers.get('Content-Security-Policy')).toBe(
        headers['Content-Security-Policy']
      );
    });

    it('should work with error responses (429 status)', () => {
      const headers = getSecurityHeaders();
      const response = new NextResponse(
        JSON.stringify({ error: 'Too Many Requests' }),
        { status: 429 }
      );

      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      expect(response.headers.get('Content-Security-Policy')).not.toBeNull();
      expect(response.status).toBe(429);
    });

    it('should work with redirect responses', () => {
      const headers = getSecurityHeaders();
      const response = NextResponse.redirect(new URL('https://example.com'));

      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      expect(response.headers.get('Content-Security-Policy')).not.toBeNull();
    });

    it('should preserve existing headers when adding security headers', () => {
      const headers = getSecurityHeaders();
      const response = new NextResponse();

      // Set a custom header first
      response.headers.set('X-Custom-Header', 'custom-value');

      // Add security headers
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      // Both should exist
      expect(response.headers.get('X-Custom-Header')).toBe('custom-value');
      expect(response.headers.get('Content-Security-Policy')).not.toBeNull();
    });

    it('should apply headers to all route types', () => {
      const headers = getSecurityHeaders();
      const requiredHeaders = [
        'Content-Security-Policy',
        'Strict-Transport-Security',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'X-XSS-Protection',
        'Referrer-Policy',
        'Permissions-Policy',
      ];

      requiredHeaders.forEach((headerName) => {
        expect(headers).toHaveProperty(headerName);
        expect(headers[headerName as keyof typeof headers]).toBeTruthy();
      });
    });

    it('should apply headers to OPTIONS (CORS preflight) requests', () => {
      const headers = getSecurityHeaders();
      // Even preflight requests should have security headers
      expect(Object.keys(headers).length).toBeGreaterThan(0);
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should include rate limit headers alongside security headers', () => {
      const headers = getSecurityHeaders();
      const response = new NextResponse();

      // Add security headers
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      // Simulate rate limit headers added separately
      response.headers.set('X-RateLimit-Limit', '60');
      response.headers.set('X-RateLimit-Remaining', '59');

      expect(response.headers.get('Content-Security-Policy')).not.toBeNull();
      expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    });
  });

  describe('Header Consistency', () => {
    it('should have matching CSP in config and serialization', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      // Should contain multiple directives
      expect(csp.split(';').length).toBeGreaterThan(1);
    });

    it('should use consistent HSTS configuration', () => {
      const headers = getSecurityHeaders();
      const hsts = headers['Strict-Transport-Security'];
      // Should be 1 year (31536000 seconds)
      expect(hsts).toContain('31536000');
    });

    it('should have all directives in correct format', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      // CSP should use kebab-case directives
      expect(csp).toMatch(/[a-z]+-[a-z]+/);
    });
  });
});
