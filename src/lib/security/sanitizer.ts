import DOMPurify from 'isomorphic-dompurify';

// Configuration for safe HTML
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li',
    'blockquote', 'code', 'pre', 'h3', 'h4', 'h5', 'h6'
  ],
  ALLOWED_ATTR: ['href', 'title', 'target'],
  KEEP_CONTENT: true,
  RETURN_DOM_FRAGMENT: false,
};

// Stricter config for comment/report content
const STRICT_SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'u', 'a', 'br'],
  ALLOWED_ATTR: ['href', 'title'],
  KEEP_CONTENT: true,
};

// URL validation
const SAFE_URL_PROTOCOLS = ['http://', 'https://', 'mailto:'];

export function isUrlSafe(url: string): boolean {
  try {
    // Reject dangerous protocols
    if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('vbscript:')) {
      return false;
    }

    // Allow relative URLs and safe protocols
    if (url.startsWith('/')) return true;
    if (SAFE_URL_PROTOCOLS.some((proto) => url.startsWith(proto))) {
      return true;
    }

    // Try parsing as URL
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize HTML content while preserving safe formatting.
 * Used for review bodies and comment text.
 * @param html - Raw HTML string from user
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeHTML(html: string): string {
  if (!html) return '';

  const dirty = html.trim();
  if (dirty.length === 0) return '';

  // First pass: remove dangerous tags
  let cleaned = DOMPurify.sanitize(dirty, SANITIZE_CONFIG);

  // Second pass: validate and clean URLs in links
  cleaned = cleaned.replace(/<a\s+href="([^"]*)"/g, (_match, url) => {
    if (isUrlSafe(url)) {
      return `<a href="${escapeHtml(url)}"`;
    }
    // Remove href attribute if URL is unsafe
    return '<a';
  });

  return cleaned;
}

/**
 * Sanitize plain text without HTML parsing.
 * Used for comments, reports, reasons.
 * @param text - Plain text from user
 * @returns Text with HTML entities escaped
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  return escapeHtml(text.trim());
}

/**
 * Sanitize markdown content (convert to safe HTML).
 * Allows markdown formatting but prevents injection.
 * @param markdown - Markdown text from user
 * @returns Safe markdown or plain text (no HTML tags)
 */
export function sanitizeMarkdown(markdown: string): string {
  if (!markdown) return '';

  const text = markdown.trim();
  if (text.length === 0) return '';

  // For now, treat markdown as plain text to prevent injection
  // TODO: Integrate marked.js with custom sanitization for full markdown support
  // For now, preserve basic formatting with escape
  return escapeHtml(text);
}

/**
 * Escape HTML special characters to prevent injection.
 * @param text - Raw text with potential HTML
 * @returns Text safe for HTML rendering
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

/**
 * Sanitize user input for display in sensitive contexts.
 * Strips all formatting, plain text only.
 * @param input - Raw user input
 * @returns Plain text with HTML escaped
 */
export function sanitizeStrict(input: string): string {
  if (!input) return '';
  // Remove all non-printable characters except spaces and newlines
  return escapeHtml(
    input
      .trim()
      .replace(/[^\p{L}\p{N}\s\-.,!?'"():]/gu, '') // Keep letters, numbers, punctuation
      .replace(/\s+/g, ' ') // Collapse whitespace
  );
}

/**
 * Sanitize user-generated content for specific contexts.
 * @param content - Raw content
 * @param context - 'review' | 'comment' | 'report' | 'plain'
 * @returns Sanitized content suitable for context
 */
export function sanitize(
  content: string,
  context: 'review' | 'comment' | 'report' | 'plain' = 'plain'
): string {
  if (!content) return '';

  const trimmed = content.trim();
  if (trimmed.length === 0) return '';

  switch (context) {
    case 'review':
      // Reviews allow rich formatting
      return sanitizeHTML(trimmed);
    case 'comment':
      // Comments allow basic formatting only
      const strict = DOMPurify.sanitize(trimmed, STRICT_SANITIZE_CONFIG);
      return strict.replace(/<a\s+href="([^"]*)"/g, (_match, url) => {
        return isUrlSafe(url) ? `<a href="${escapeHtml(url)}"` : '<a';
      });
    case 'report':
    case 'plain':
    default:
      // Reports and plain text: escape all HTML
      return escapeHtml(trimmed);
  }
}

/**
 * Remove HTML tags completely, return plain text.
 * Useful for previews or plain-text exports.
 * @param html - HTML string
 * @returns Plain text with all tags removed
 */
export function stripTags(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Detect if content contains suspicious patterns.
 * @param content - Content to analyze
 * @returns Array of detected patterns
 */
export function detectSuspiciousPatterns(content: string): string[] {
  const patterns = [];

  // Detect encoded scripts
  if (content.includes('eval(') || content.includes('Function(')) {
    patterns.push('eval_function');
  }

  // Detect multiple URLs (spam indicator)
  const urlCount = (content.match(/https?:\/\//g) || []).length;
  if (urlCount > 3) {
    patterns.push('excessive_urls');
  }

  // Detect suspicious encoding
  if (content.includes('\\x') || content.includes('\\u')) {
    patterns.push('suspicious_encoding');
  }

  // Detect event handlers (shouldn't survive sanitization, but check)
  if (/on\w+\s*=\s*["']/i.test(content)) {
    patterns.push('event_handler');
  }

  return patterns;
}
