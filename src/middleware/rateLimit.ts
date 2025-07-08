// src/middleware/rateLimit.ts

import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { HEADERS } from '../config/constants';
import type { Env, RateLimitData, Variables } from '../types';
import { serializeError } from '../types/errors';
import { createLogger } from '../utils/logger';

interface RateLimitOptions {
  requests: number;
  window: string; // e.g., '1m', '1h'
  keyPrefix?: string; // Custom prefix for rate limit keys
  skipIf?: (c: Context) => boolean; // Skip rate limiting conditionally
  onLimitExceeded?: (c: Context, data: RateLimitData) => void;
}

// Parse window string to milliseconds
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid rate limit window format: ${window}`);
  }

  const [, num, unit] = match;
  const multipliers = {
    s: 1000, // seconds
    m: 60000, // minutes
    h: 3600000, // hours
    d: 86400000 // days
  };

  return parseInt(num) * multipliers[unit as keyof typeof multipliers];
}

// Get client identifier for rate limiting
function getClientIdentifier(c: Context): string {
  // Priority: CF-Connecting-IP > X-Forwarded-For > X-Real-IP > fallback
  return c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0].trim() ||
    c.req.header('X-Real-IP') ||
    'anonymous';
}

/**
 * NOTE ON ATOMICITY:
 * This rate limiter uses a read-modify-write pattern on Cloudflare KV.
 * While highly available, KV does not guarantee atomicity for this pattern.
 * Under very high concurrency from a single IP, it's theoretically possible
 * for the limit to be exceeded slightly.
 * For most use cases, this is an acceptable trade-off. For guaranteed atomic
 * counting, the recommended solution is to use Cloudflare Durable Objects,
 * which would be a more significant architectural change.
 */
export const rateLimiter = (options: RateLimitOptions) => {
  const windowMs = parseWindow(options.window);
  const windowSeconds = Math.ceil(windowMs / 1000);
  const keyPrefix = options.keyPrefix || 'rate_limit';

  return async (c: Context<{ Bindings: Env, Variables: Variables }>, next: Next) => {
    const logger = createLogger(c);

    // Check if we should skip rate limiting
    if (options.skipIf?.(c)) {
      logger.debug('Skipping rate limit check');
      return next();
    }

    const validatedEnv = c.get('validatedEnv');
    const kv = c.env.RATE_LIMITER;

    // In production, rate limiter must be configured
    if (!kv && validatedEnv.NODE_ENV === 'production') {
      logger.error('Rate limiter KV namespace not configured in production');
      throw new HTTPException(500, { message: 'Internal server error' });
    }

    // Skip if KV not available in development
    if (!kv) {
      logger.warn('Rate limiter KV namespace not configured, skipping rate limiting');
      return next();
    }

    const clientIp = getClientIdentifier(c);
    const key = `${keyPrefix}:${clientIp}:${c.req.path}`;
    const now = Date.now();

    try {
      // Get current rate limit data
      const data = await kv.get<RateLimitData>(key, 'json');

      if (!data || data.resetTime < now) {
        // New window or expired
        const newData: RateLimitData = { count: 1, resetTime: now + windowMs };

        // Store with expiration
        await kv.put(key, JSON.stringify(newData), { expirationTtl: windowSeconds });

        // Add rate limit headers
        c.header(HEADERS.RATE_LIMIT_LIMIT, options.requests.toString());
        c.header(HEADERS.RATE_LIMIT_REMAINING, (options.requests - 1).toString());
        c.header(HEADERS.RATE_LIMIT_RESET, Math.floor(newData.resetTime / 1000).toString());

        logger.debug('Rate limit window started', {
          clientIp,
          path: c.req.path,
          window: options.window,
          remaining: options.requests - 1
        });
      } else {
        // Existing window
        if (data.count >= options.requests) {
          // Rate limit exceeded
          const retryAfter = Math.ceil((data.resetTime - now) / 1000);

          logger.warn('Rate limit exceeded', {
            clientIp,
            path: c.req.path,
            count: data.count,
            limit: options.requests,
            retryAfter,
            userAgent: c.req.header(HEADERS.USER_AGENT)
          });

          // Set response headers
          c.header(HEADERS.RATE_LIMIT_LIMIT, options.requests.toString());
          c.header(HEADERS.RATE_LIMIT_REMAINING, '0');
          c.header(HEADERS.RATE_LIMIT_RESET, Math.floor(data.resetTime / 1000).toString());
          c.header(HEADERS.RETRY_AFTER, retryAfter.toString());

          // Call custom handler if provided
          options.onLimitExceeded?.(c, data);

          throw new HTTPException(429, {
            message: 'Rate limit exceeded',
            cause: {
              retryAfter,
              limit: options.requests,
              window: options.window,
              reset: new Date(data.resetTime).toISOString()
            }
          });
        }

        // Increment count
        data.count++;

        // Update in KV
        const ttl = Math.ceil((data.resetTime - now) / 1000);
        if (ttl > 0) {
          await kv.put(key, JSON.stringify(data), { expirationTtl: ttl });
        }

        // Add rate limit headers
        c.header(HEADERS.RATE_LIMIT_LIMIT, options.requests.toString());
        c.header(HEADERS.RATE_LIMIT_REMAINING, (options.requests - data.count).toString());
        c.header(HEADERS.RATE_LIMIT_RESET, Math.floor(data.resetTime / 1000).toString());
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      // Log KV errors
      logger.error('Rate limiter error', { error: serializeError(error), key, clientIp });

      // In production, fail closed (deny request)
      if (validatedEnv.NODE_ENV === 'production') {
        throw new HTTPException(500, { message: 'Internal server error' });
      }

      // In development, fail open (allow request)
      logger.warn('Rate limiter failed open in development mode');
    }

    await next();
  };
};

// Factory function for common rate limit configurations
export const createRateLimiter = {
  api: (overrides?: Partial<RateLimitOptions>) =>
    rateLimiter({ requests: 100, window: '1m', keyPrefix: 'api', ...overrides }),

  beta: (overrides?: Partial<RateLimitOptions>) =>
    rateLimiter({ requests: 50, window: '1m', keyPrefix: 'beta', ...overrides }),

  docs: (overrides?: Partial<RateLimitOptions>) =>
    rateLimiter({ requests: 200, window: '1h', keyPrefix: 'docs', ...overrides })
};
