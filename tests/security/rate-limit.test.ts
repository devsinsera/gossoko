// tests/security/rate-limit.test.ts
// Comprehensive test suite for sliding window rate limiter

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, getRateLimitKey } from '@/lib/security/rate-limiter';
import { RATE_LIMITS } from '@/config/security';

// Mock Redis client for testing
class MockRedis {
  private data: Map<string, Array<{ score: number; member: string }>> = new Map();
  private expirations: Map<string, number> = new Map();

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    const items = this.data.get(key) || [];
    if (items.length === 0) return 0;

    const original = items.length;
    // ZREMRANGEBYSCORE removes items with scores in [min, max], so keep items outside range
    const filtered = items.filter((item) => item.score < min || item.score > max);
    if (filtered.length !== original) {
      this.data.set(key, filtered);
      return original - filtered.length;
    }
    return 0;
  }

  async zcard(key: string): Promise<number> {
    return (this.data.get(key) || []).length;
  }

  async zadd(
    key: string,
    options: { score: number; member: string }
  ): Promise<number> {
    const items = this.data.get(key) || [];
    items.push(options);
    this.data.set(key, items);
    return 1;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.expirations.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async del(key: string): Promise<number> {
    const existed = this.data.has(key);
    this.data.delete(key);
    this.expirations.delete(key);
    return existed ? 1 : 0;
  }

  async zrange(key: string, start: number, stop: number, options?: { withScores?: boolean }): Promise<any[]> {
    const items = this.data.get(key) || [];
    const sliced = items.slice(start, stop + 1);

    if (options?.withScores) {
      return sliced.map((item) => ({
        member: item.member,
        score: item.score.toString(),
      }));
    }

    return sliced.map((item) => item.member);
  }

  // Evaluate Lua script - simplified implementation for testing
  async eval(
    script: string,
    numKeys: number,
    ...args: string[]
  ): Promise<[number, number]> {
    // Extract KEYS and ARGV from arguments
    const keys = args.slice(0, numKeys);
    const argv = args.slice(numKeys);

    const key = keys[0];
    const windowStart = parseInt(argv[0], 10);
    const maxLimit = parseInt(argv[1], 10);
    const score = parseInt(argv[2], 10);
    const member = argv[3];
    const ttl = parseInt(argv[4], 10);

    // Remove expired entries
    const items = this.data.get(key) || [];
    const activeItems = items.filter((item) => item.score > windowStart);

    const count = activeItems.length;

    if (count < maxLimit) {
      // Add new entry
      activeItems.push({ score, member });
      this.data.set(key, activeItems);
      this.expirations.set(key, Date.now() + ttl * 1000);
      return [1, count];
    } else {
      // Limit exceeded
      return [0, count];
    }
  }

  // Helper to clear all data
  clear(): void {
    this.data.clear();
    this.expirations.clear();
  }
}

describe('RateLimiter', () => {
  let limiter: RateLimiter;
  let mockRedis: MockRedis;

  beforeEach(() => {
    mockRedis = new MockRedis();
    limiter = new RateLimiter(mockRedis as any);
  });

  afterEach(() => {
    mockRedis.clear();
  });

  describe('checkLimit', () => {
    it('should allow requests within limit', async () => {
      const result = await limiter.checkLimit('api', 'user-123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('should track remaining requests correctly', async () => {
      const max = RATE_LIMITS.api.max;
      const result1 = await limiter.checkLimit('api', 'user-track');

      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(max - 1);

      const result2 = await limiter.checkLimit('api', 'user-track');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(max - 2);
    });

    it('should block requests exceeding limit', async () => {
      const type = 'auth';
      const max = RATE_LIMITS[type].max;

      // Exhaust limit
      for (let i = 0; i < max; i++) {
        const result = await limiter.checkLimit(type, 'user-auth');
        expect(result.allowed).toBe(true);
      }

      // Next request should fail
      const blocked = await limiter.checkLimit(type, 'user-auth');
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    it('should reset after window expires', async () => {
      const identifier = 'user-reset';
      const type = 'uploads';
      const max = RATE_LIMITS[type].max;

      // Make max requests
      for (let i = 0; i < max; i++) {
        await limiter.checkLimit(type, identifier);
      }

      // Should be blocked
      let blocked = await limiter.checkLimit(type, identifier);
      expect(blocked.allowed).toBe(false);

      // Reset
      await limiter.reset(type, identifier);

      // Should allow again
      const result = await limiter.checkLimit(type, identifier);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(max - 1);
    });

    it('should handle different types independently', async () => {
      const identifier = 'user-types';

      const api = await limiter.checkLimit('api', identifier);
      expect(api.allowed).toBe(true);
      expect(api.remaining).toBe(RATE_LIMITS.api.max - 1);

      const auth = await limiter.checkLimit('auth', identifier);
      expect(auth.allowed).toBe(true);
      expect(auth.remaining).toBe(RATE_LIMITS.auth.max - 1);

      // Limits should be independent
      expect(api.remaining).not.toBe(auth.remaining);
    });

    it('should handle different identifiers independently', async () => {
      const type = 'api';
      const max = RATE_LIMITS[type].max;

      // Exhaust limit for user-1
      for (let i = 0; i < max; i++) {
        await limiter.checkLimit(type, 'user-1');
      }

      // user-1 should be blocked
      let blocked = await limiter.checkLimit(type, 'user-1');
      expect(blocked.allowed).toBe(false);

      // But user-2 should still work
      const user2 = await limiter.checkLimit(type, 'user-2');
      expect(user2.allowed).toBe(true);
      expect(user2.remaining).toBe(max - 1);
    });

    it('should return correct resetAt timestamp', async () => {
      const result = await limiter.checkLimit('api', 'user-timestamp');
      const now = Date.now();

      expect(result.resetAt.getTime()).toBeGreaterThan(now);
      expect(result.resetAt.getTime() - now).toBeLessThanOrEqual(
        RATE_LIMITS.api.windowMs + 100
      ); // Allow small variance
    });

    it('should calculate retryAfter correctly', async () => {
      const type = 'auth';
      const max = RATE_LIMITS[type].max;

      // Exhaust limit
      for (let i = 0; i < max; i++) {
        await limiter.checkLimit(type, 'user-retry');
      }

      // Get blocked response
      const blocked = await limiter.checkLimit(type, 'user-retry');
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfter).toBeGreaterThan(0);
      expect(blocked.retryAfter).toBeLessThanOrEqual(
        Math.ceil(RATE_LIMITS[type].windowMs / 1000)
      );
    });

    it('should handle all rate limit types', async () => {
      const types: Array<keyof typeof RATE_LIMITS> = [
        'api',
        'auth',
        'uploads',
        'contentCreation',
        'reportSubmission',
      ];

      for (const type of types) {
        const result = await limiter.checkLimit(type, 'test-user');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(RATE_LIMITS[type].max - 1);
      }
    });

    it('should fail-open when Redis fails', async () => {
      // Create limiter with no Redis
      const noRedisLimiter = new RateLimiter(null as any);

      const result = await noRedisLimiter.checkLimit('api', 'user-fallback');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1); // Indicates fallback
    });

    it('should handle Redis errors gracefully', async () => {
      const errorRedis = {
        zremrangebyscore: vi.fn().mockRejectedValue(new Error('Redis error')),
        zcard: vi.fn().mockRejectedValue(new Error('Redis error')),
        zadd: vi.fn().mockRejectedValue(new Error('Redis error')),
        expire: vi.fn().mockRejectedValue(new Error('Redis error')),
        del: vi.fn().mockRejectedValue(new Error('Redis error')),
        zrange: vi.fn().mockRejectedValue(new Error('Redis error')),
      };

      const errorLimiter = new RateLimiter(errorRedis as any);
      const result = await errorLimiter.checkLimit('api', 'user-error');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1);
    });
  });

  describe('getRateLimitKey', () => {
    it('should generate consistent keys', () => {
      const key1 = getRateLimitKey('api', 'user-123');
      const key2 = getRateLimitKey('api', 'user-123');

      expect(key1).toBe(key2);
      expect(key1).toBe('rate-limit:api:user-123');
    });

    it('should differentiate by type', () => {
      const apiKey = getRateLimitKey('api', 'id');
      const authKey = getRateLimitKey('auth', 'id');
      const uploadsKey = getRateLimitKey('uploads', 'id');

      expect(apiKey).not.toBe(authKey);
      expect(authKey).not.toBe(uploadsKey);
    });

    it('should differentiate by identifier', () => {
      const key1 = getRateLimitKey('api', 'user-1');
      const key2 = getRateLimitKey('api', 'user-2');

      expect(key1).not.toBe(key2);
    });

    it('should include all components in key', () => {
      const key = getRateLimitKey('contentCreation', 'ip-192.168.1.1');

      expect(key).toContain('rate-limit');
      expect(key).toContain('contentCreation');
      expect(key).toContain('ip-192.168.1.1');
    });
  });

  describe('reset', () => {
    it('should clear rate limit state', async () => {
      const identifier = 'user-clear';
      const type = 'api';
      const max = RATE_LIMITS[type].max;

      // Make requests to near limit
      for (let i = 0; i < max - 1; i++) {
        await limiter.checkLimit(type, identifier);
      }

      // Reset
      await limiter.reset(type, identifier);

      // Should allow full limit again
      const result = await limiter.checkLimit(type, identifier);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(max - 1);
    });

    it('should handle reset when key does not exist', async () => {
      // Should not throw
      await expect(
        limiter.reset('api', 'non-existent-user')
      ).resolves.not.toThrow();
    });

    it('should only reset specified type and identifier', async () => {
      const identifier = 'user-selective';
      const max = RATE_LIMITS.api.max;

      // Exhaust api limit
      for (let i = 0; i < max; i++) {
        await limiter.checkLimit('api', identifier);
      }

      // Make one auth request
      await limiter.checkLimit('auth', identifier);

      // Reset only api
      await limiter.reset('api', identifier);

      // Api should be reset
      const api = await limiter.checkLimit('api', identifier);
      expect(api.allowed).toBe(true);

      // Auth should still have limit
      const auth = await limiter.checkLimit('auth', identifier);
      expect(auth.remaining).toBe(RATE_LIMITS.auth.max - 2);
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent requests without race condition', async () => {
      const identifier = 'user-concurrent-race';
      const type = 'api';
      const maxRequests = RATE_LIMITS[type].max;

      // Send MORE concurrent requests than the limit allows
      // If race condition exists, more than maxRequests would be allowed
      const concurrentCount = maxRequests + 20;
      const promises = Array.from({ length: concurrentCount }, () =>
        limiter.checkLimit(type, identifier)
      );

      const results = await Promise.all(promises);

      // Count allowed vs blocked
      const allowed = results.filter((r) => r.allowed).length;
      const blocked = results.filter((r) => !r.allowed).length;

      // Should enforce the limit strictly
      expect(allowed).toBe(maxRequests);
      expect(blocked).toBe(concurrentCount - maxRequests);

      // All blocked requests should have retryAfter
      results.forEach((result) => {
        if (!result.allowed) {
          expect(result.retryAfter).toBeGreaterThan(0);
        }
      });
    });

    it('should handle concurrent requests', async () => {
      const identifier = 'user-concurrent';
      const type = 'api';

      const promises = Array.from({ length: 10 }, () =>
        limiter.checkLimit(type, identifier)
      );

      const results = await Promise.all(promises);

      // All should be allowed
      const allowed = results.filter((r) => r.allowed).length;
      expect(allowed).toBeGreaterThan(0);

      // Remaining should decrease
      const remaining = results.map((r) => r.remaining);
      for (let i = 1; i < remaining.length; i++) {
        expect(remaining[i]).toBeLessThanOrEqual(remaining[i - 1]);
      }
    });

    it('should handle empty identifier gracefully', async () => {
      const result = await limiter.checkLimit('api', '');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it('should handle special characters in identifier', async () => {
      const specialIdentifier = 'user@example.com:192.168.1.1';

      const result = await limiter.checkLimit('api', specialIdentifier);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMITS.api.max - 1);
    });
  });
});
