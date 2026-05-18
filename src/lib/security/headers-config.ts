// src/lib/security/headers-config.ts
// Security headers configuration and serialization
// Converts security config objects into HTTP response headers

import { SECURITY_HEADERS } from '@/config/security';

/**
 * CSP directives in camelCase for type safety
 */
export type CSPDirective =
  | 'defaultSrc'
  | 'scriptSrc'
  | 'styleSrc'
  | 'imgSrc'
  | 'fontSrc'
  | 'connectSrc'
  | 'frameSrc'
  | 'baseUri'
  | 'formAction'
  | 'objectSrc'
  | 'mediaSrc'
  | 'childSrc'
  | 'manifestSrc'
  | 'workerSrc';

/**
 * Permissions Policy features that can be controlled
 */
export type PermissionsPolicyFeature =
  | 'camera'
  | 'microphone'
  | 'geolocation'
  | 'usb'
  | 'magnetometer'
  | 'gyroscope'
  | 'accelerometer'
  | 'ambientLightSensor'
  | 'autoplay'
  | 'encryptedMedia'
  | 'fullscreen'
  | 'identifers'
  | 'payment'
  | 'pictureinpicture'
  | 'syncXhr'
  | 'vr'
  | 'xrSpatialTracking';

/**
 * CSP directives object
 */
export interface CSPConfig {
  [key: string]: string[];
}

/**
 * HSTS configuration
 */
export interface HSTSConfig {
  maxAge: number;
  includeSubDomains: boolean;
  preload: boolean;
}

/**
 * Permissions Policy configuration
 */
export type PermissionsPolicyConfig = {
  [key in PermissionsPolicyFeature]?: string[];
};

/**
 * Convert camelCase directive name to kebab-case
 * Example: scriptSrc -> script-src, defaultSrc -> default-src
 */
function camelCaseToKebabCase(camelCase: string): string {
  return camelCase.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Serialize CSP directives object to CSP header string
 * @param directives - Object with camelCase directive names and string array values
 * @returns CSP header value string
 *
 * Example input: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "vercel.live"] }
 * Example output: "default-src 'self'; script-src 'self' vercel.live"
 */
export function serializeCSP(directives: CSPConfig): string {
  const parts: string[] = [];

  for (const [directive, values] of Object.entries(directives)) {
    if (!Array.isArray(values) || values.length === 0) {
      continue;
    }

    const kebabDirective = camelCaseToKebabCase(directive);
    const joinedValues = values.join(' ');
    parts.push(`${kebabDirective} ${joinedValues}`);
  }

  return parts.join('; ');
}

/**
 * Serialize HSTS configuration to header string
 * @param hsts - HSTS configuration object
 * @returns HSTS header value string
 *
 * Example output: "max-age=31536000; includeSubDomains; preload"
 */
export function serializeHSTS(hsts: HSTSConfig): string {
  const parts: string[] = [];

  // Always include max-age
  parts.push(`max-age=${hsts.maxAge}`);

  // Include includeSubDomains if true
  if (hsts.includeSubDomains) {
    parts.push('includeSubDomains');
  }

  // Include preload if true
  if (hsts.preload) {
    parts.push('preload');
  }

  return parts.join('; ');
}

/**
 * Serialize Permissions Policy configuration to header string
 * @param policy - Permissions Policy configuration object
 * @returns Permissions-Policy header value string
 *
 * Example output: "camera=(), microphone=(), geolocation=()"
 */
export function serializePermissionsPolicy(policy: PermissionsPolicyConfig): string {
  const parts: string[] = [];

  for (const [feature, allowlist] of Object.entries(policy)) {
    if (!Array.isArray(allowlist)) {
      continue;
    }

    if (allowlist.length === 0) {
      // Empty allowlist = feature disabled
      parts.push(`${feature}=()`);
    } else {
      // With specific origins
      const origins = allowlist.map((origin) => `"${origin}"`).join(', ');
      parts.push(`${feature}=(${origins})`);
    }
  }

  return parts.join(', ');
}

/**
 * Get all security headers as key-value pairs
 * @returns Record of header names to header values
 */
export function getSecurityHeaders(): Record<string, string> {
  // For now, return the headers from the config directly
  // This maintains compatibility with the existing SECURITY_HEADERS config
  const headers: Record<string, string> = {
    'Content-Security-Policy':
      SECURITY_HEADERS['Content-Security-Policy'],
    'Strict-Transport-Security': SECURITY_HEADERS['Strict-Transport-Security'],
    'X-Frame-Options': SECURITY_HEADERS['X-Frame-Options'],
    'X-Content-Type-Options': SECURITY_HEADERS['X-Content-Type-Options'],
    'X-XSS-Protection': SECURITY_HEADERS['X-XSS-Protection'],
    'Referrer-Policy': SECURITY_HEADERS['Referrer-Policy'],
    'Permissions-Policy': SECURITY_HEADERS['Permissions-Policy'],
  };

  return headers;
}

/**
 * Utility function to build security headers from structured config
 * Can be used in the future when we migrate SECURITY_HEADERS to structured format
 *
 * @param csp - CSP directives configuration
 * @param hsts - HSTS configuration
 * @param permissionsPolicy - Permissions Policy configuration
 * @returns Complete security headers object
 */
export function buildSecurityHeaders(
  csp: CSPConfig,
  hsts: HSTSConfig,
  permissionsPolicy: PermissionsPolicyConfig
): Record<string, string> {
  return {
    'Content-Security-Policy': serializeCSP(csp),
    'Strict-Transport-Security': serializeHSTS(hsts),
    'Permissions-Policy': serializePermissionsPolicy(permissionsPolicy),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}
