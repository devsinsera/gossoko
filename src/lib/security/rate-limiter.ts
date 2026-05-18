// src/lib/security/rate-limiter.ts
// Production-grade sliding window rate limiter using Redis
// Implements per-endpoint rate limiting with graceful degradation

import { RATE_LIMITS } from '@/config/security';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds until retry
}

// Generic Redis-like interface to support multiple clients
interface RedisClient {
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;
  zcard(key: string): Promise<number>;
  zadd(key: string, options: { score: number; member: string }): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;
  zrange(key: string, start: number, stop: number, options?: { withScores?: boolean }): Promise<any[]>;
  eval?(script: string, numKeys: number, ...args: string[]): Promise<any>;
}

export class RateLimiter {
  private redis: RedisClient | null = null;

  constructor(redisClient?: RedisClient) {
    this.redis = redisClient || null;

    // Try to initialize Redis if URL is provided and no client passed
    if (!this.redis && process.env.REDIS_URL) {
      try {
        // Dynamically import based on environment
        // For Upstash (serverless): import { Redis } from '@upstash/redis';
        // For local Redis: import { createClient } from 'redis';
        // This is a compatibility shim - in production, initialize with your Redis client
        console.debug('Rate limiter: Redis URL found but no client provided');
      } catch (error) {
        console.error('Failed to initialize Redis client:', error);
      }
    }
  }

  /**
   * Check if a request is within rate limits
   * Uses atomic Lua script to prevent race conditions
   * @param type Rate limit type (api, auth, uploads, etc.)
   * @param identifier User ID, IP, or combination
   * @returns Result with allowed status, remaining requests, and reset time
   */
  async checkLimit(
    type: keyof typeof RATE_LIMITS,
    identifier: string
  ): Promise<RateLimitResult> {
    // Fail-open: if Redis unavailable, allow request
    if (!this.redis) {
      return {
        allowed: true,
        remaining: -1, // -1 indicates fallback/no Redis
        resetAt: new Date(),
      };
    }

    // Validate type exists in config
    if (!(type in RATE_LIMITS)) {
      throw new Error(`Invalid rate limit type: ${type}`);
    }

    const config = RATE_LIMITS[type];
    const key = getRateLimitKey(type, identifier);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Lua script for atomic check-and-increment operation
      // Prevents race condition where multiple requests could all pass the check
      const script = `
        redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
        local count = redis.call('ZCARD', KEYS[1])
        if count < tonumber(ARGV[2]) then
          redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
          redis.call('EXPIRE', KEYS[1], ARGV[5])
          return {1, count}
        else
          return {0, count}
        end
      `;

      // Check if Redis client supports eval (Lua script execution)
      if (this.redis.eval) {
        const result = await this.redis.eval(
          script,
          1, // numKeys
          key, // KEYS[1]
          windowStart.toString(), // ARGV[1] - window start time
          config.max.toString(), // ARGV[2] - max limit
          now.toString(), // ARGV[3] - score (timestamp)
          `${now}-${Math.random().toString(36).substring(2, 9)}`, // ARGV[4] - member
          (Math.ceil(config.windowMs / 1000) + 1).toString() // ARGV[5] - TTL
        );

        const [allowed, count] = result as [number, number];

        if (allowed === 1) {
          return {
            allowed: true,
            remaining: config.max - count - 1,
            resetAt: new Date(now + config.windowMs),
          };
        }

        // Limit exceeded - get oldest timestamp for reset time
        const oldest = await this.redis.zrange(key, 0, 0, { withScores: true });
        let resetAt = new Date(now + config.windowMs);

        if (oldest && oldest.length > 0) {
          const oldestScore = parseInt(oldest[0].score as string, 10);
          resetAt = new Date(oldestScore + config.windowMs);
        }

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter: Math.ceil((resetAt.getTime() - now) / 1000),
        };
      } else {
        // Fallback to non-atomic implementation if Lua not supported
        console.warn('Redis client does not support Lua scripts, using fallback non-atomic implementation');
        return await this.checkLimitFallback(type, config, key, now, windowStart);
      }
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail-open: allow request if Redis fails
      return {
        allowed: true,
        remaining: -1,
        resetAt: new Date(),
      };
    }
  }

  /**
   * Fallback implementation for Redis clients that don't support Lua scripts
   * Note: This is NOT atomic and may have race conditions under high concurrency
   * @private
   */
  private async checkLimitFallback(
    _type: keyof typeof RATE_LIMITS,
    config: typeof RATE_LIMITS[keyof typeof RATE_LIMITS],
    key: string,
    now: number,
    windowStart: number
  ): Promise<RateLimitResult> {
    // Remove expired entries
    await this.redis!.zremrangebyscore(key, 0, windowStart);

    // Count requests in current window
    const count = await this.redis!.zcard(key);

    if (count < config.max) {
      // Add current request
      const member = `${now}-${Math.random().toString(36).substring(2, 9)}`;
      await this.redis!.zadd(key, { score: now, member });
      await this.redis!.expire(key, Math.ceil(config.windowMs / 1000) + 1);

      return {
        allowed: true,
        remaining: config.max - count - 1,
        resetAt: new Date(now + config.windowMs),
      };
    }

    // Limit exceeded
    const oldest = await this.redis!.zrange(key, 0, 0);
    let resetAt = new Date(now + config.windowMs);

    if (oldest && oldest.length > 0) {
      const oldestTimestamp = parseInt(oldest[0].split('-')[0], 10);
      resetAt = new Date(oldestTimestamp + config.windowMs);
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.ceil((resetAt.getTime() - now) / 1000),
    };
  }

  /**
   * Reset rate limit for an identifier
   * @param type Rate limit type
   * @param identifier User ID, IP, or combination
   */
  async reset(type: keyof typeof RATE_LIMITS, identifier: string): Promise<void> {
    if (!this.redis) return;

    try {
      const key = getRateLimitKey(type, identifier);
      await this.redis.del(key);
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
    }
  }
}

/**
 * Generate a consistent Redis key for rate limiting
 * @param type Rate limit type
 * @param identifier User ID, IP, or combination
 * @returns Redis key string
 */
export function getRateLimitKey(type: keyof typeof RATE_LIMITS, identifier: string): string {
  return `rate-limit:${type}:${identifier}`;
}

/**
 * Create and export singleton instance
 * In production, this should be initialized with your Redis client
 */
export const rateLimiter = new RateLimiter();
