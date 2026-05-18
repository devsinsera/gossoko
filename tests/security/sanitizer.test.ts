import { describe, it, expect } from 'vitest';
import {
  sanitizeHTML,
  sanitizeText,
  sanitizeMarkdown,
  escapeHtml,
  sanitizeStrict,
  sanitize,
  stripTags,
  isUrlSafe,
  detectSuspiciousPatterns,
} from '@/lib/security/sanitizer';

describe('Content Sanitization', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
      expect(escapeHtml("It's fine")).toBe('It&#39;s fine');
    });

    it('should handle mixed content', () => {
      const input = '<img src=x onerror="alert(1)">';
      const output = escapeHtml(input);
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
    });
  });

  describe('sanitizeHTML', () => {
    it('should preserve safe HTML formatting', () => {
      const safe = '<p>Great <strong>coffee</strong> here!</p>';
      const result = sanitizeHTML(safe);
      expect(result).toContain('Great');
      expect(result).toContain('coffee');
    });

    it('should remove script tags', () => {
      const xss = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
      const result = sanitizeHTML(xss);
      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('should remove event handlers', () => {
      const xss = '<img src=x onerror="alert(1)">';
      const result = sanitizeHTML(xss);
      expect(result).not.toContain('onerror');
    });

    it('should allow safe links', () => {
      const safe = '<p>Check out <a href="https://example.com">this link</a></p>';
      const result = sanitizeHTML(safe);
      expect(result).toContain('href=');
      expect(result).toContain('https://example.com');
    });

    it('should remove javascript: URLs', () => {
      const xss = '<a href="javascript:alert(1)">click</a>';
      const result = sanitizeHTML(xss);
      expect(result).not.toContain('javascript:');
    });

    it('should handle empty strings', () => {
      expect(sanitizeHTML('')).toBe('');
      expect(sanitizeHTML('   ')).toBe('');
    });
  });

  describe('sanitizeText', () => {
    it('should escape HTML in plain text', () => {
      const input = 'Hello <script>alert(1)</script> World';
      const result = sanitizeText(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
    });

    it('should preserve regular punctuation', () => {
      const input = "It's great! Love it? Yes, definitely.";
      const result = sanitizeText(input);
      expect(result).toContain('It&#39;s');
      expect(result).toContain('great!');
    });
  });

  describe('sanitizeMarkdown', () => {
    it('should escape markdown syntax to prevent injection', () => {
      const input = '**bold** and _italic_';
      const result = sanitizeMarkdown(input);
      // Should escape asterisks and underscores
      expect(result).not.toContain('<strong>');
      expect(result).not.toContain('<em>');
    });

    it('should handle empty markdown', () => {
      expect(sanitizeMarkdown('')).toBe('');
    });
  });

  describe('sanitizeStrict', () => {
    it('should remove all HTML and special formatting', () => {
      const input = '<p>Test</p> & "quotes"';
      const result = sanitizeStrict(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should collapse multiple spaces', () => {
      const input = 'Multiple   spaces     here';
      const result = sanitizeStrict(input);
      expect(result).toBe('Multiple spaces here');
    });
  });

  describe('sanitize context-aware', () => {
    const testContent = 'This is <b>bold</b> and <a href="https://example.com">a link</a>';

    it('should use different rules for different contexts', () => {
      const review = sanitize(testContent, 'review');
      const comment = sanitize(testContent, 'comment');
      const report = sanitize(testContent, 'report');

      // Review allows more HTML
      expect(review).toContain('<');
      // Comment allows some HTML
      expect(comment).toContain('<');
      // Report escapes all HTML
      expect(report).not.toContain('<b>');
    });
  });

  describe('stripTags', () => {
    it('should remove all HTML tags', () => {
      const html = '<p>Hello <strong>World</strong>!</p>';
      const result = stripTags(html);
      expect(result).toBe('Hello World!');
    });

    it('should handle nested tags', () => {
      const html = '<div><p><span>Text</span></p></div>';
      const result = stripTags(html);
      expect(result).toBe('Text');
    });
  });

  describe('isUrlSafe', () => {
    it('should allow safe protocols', () => {
      expect(isUrlSafe('https://example.com')).toBe(true);
      expect(isUrlSafe('http://example.com')).toBe(true);
      expect(isUrlSafe('mailto:user@example.com')).toBe(true);
      expect(isUrlSafe('/relative/path')).toBe(true);
    });

    it('should block dangerous protocols', () => {
      expect(isUrlSafe('javascript:alert(1)')).toBe(false);
      expect(isUrlSafe('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isUrlSafe('vbscript:msgbox(1)')).toBe(false);
    });

    it('should validate URL format', () => {
      expect(isUrlSafe('not a valid url')).toBe(false);
    });
  });

  describe('detectSuspiciousPatterns', () => {
    it('should detect eval() usage', () => {
      const content = 'This is a review with eval(someCode)';
      const patterns = detectSuspiciousPatterns(content);
      expect(patterns).toContain('eval_function');
    });

    it('should detect excessive URLs', () => {
      const content = 'Check https://site1.com and https://site2.com and https://site3.com and https://site4.com';
      const patterns = detectSuspiciousPatterns(content);
      expect(patterns).toContain('excessive_urls');
    });

    it('should detect suspicious encoding', () => {
      const content = 'Content with \\x48\\x65\\x6c\\x6c\\x6f';
      const patterns = detectSuspiciousPatterns(content);
      expect(patterns).toContain('suspicious_encoding');
    });

    it('should detect event handlers', () => {
      const content = 'text with onclick = "alert(1)"';
      const patterns = detectSuspiciousPatterns(content);
      expect(patterns).toContain('event_handler');
    });

    it('should return empty array for clean content', () => {
      const content = 'This is a normal review with no suspicious patterns';
      const patterns = detectSuspiciousPatterns(content);
      expect(patterns).toHaveLength(0);
    });
  });

  describe('XSS vector tests', () => {
    const xssVectors = [
      '<img src=x onerror="alert(1)">',
      '<svg onload="alert(1)">',
      '<iframe src="javascript:alert(1)">',
      '<body onload="alert(1)">',
      '<input onfocus="alert(1)" autofocus>',
      '<select onfocus="alert(1)" autofocus>',
      '<textarea onfocus="alert(1)" autofocus>',
      '<marquee onstart="alert(1)">',
      '<img src="x" alt="test" title="x" onclick="alert(1)">',
      '<!--[if gte IE 4]><script>alert(1)</script><![endif]-->',
    ];

    xssVectors.forEach((vector) => {
      it(`should block XSS vector: ${vector.substring(0, 30)}...`, () => {
        const result = sanitizeHTML(vector);
        // Should not contain executable JavaScript
        expect(result).not.toContain('alert(');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('onload=');
        expect(result).not.toContain('onerror=');
        expect(result).not.toContain('onfocus=');
      });
    });
  });
});
