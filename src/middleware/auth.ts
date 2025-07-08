// src/middleware/auth.ts

import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { HEADERS, PUBLIC_PATHS } from '../config/constants';
import type { ValidatedEnv } from '../config/env';
import type { Variables } from '../types';
import { createLogger } from '../utils/logger';

// Constant-time string comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0;i < a.length;i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

export const authMiddleware = async (c: Context<{ Variables: Variables }>, next: Next) => {
  const path = c.req.path;

  // Skip auth for public endpoints
  if (PUBLIC_PATHS.includes(path as any)) {
    // Add security headers even for public endpoints
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header(HEADERS.REQUEST_ID, c.get('requestId') || '');

    return next();
  }

  const logger = createLogger(c);
  const authHeader = c.req.header('Authorization');
  const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

  // Check for authorization header
  if (!authHeader) {
    logger.warn('Missing authorization header', { path, clientIp, userAgent: c.req.header('User-Agent') });

    throw new HTTPException(401, { message: 'Missing authorization header' });
  }

  // Validate Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('Invalid authorization header format', { path, clientIp, headerStart: authHeader.substring(0, 10) });

    throw new HTTPException(401, { message: 'Invalid authorization header format' });
  }

  const providedToken = authHeader.substring(7);
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv;

  // Validate token length
  if (providedToken.length < 32) {
    logger.warn('Token too short', { path, clientIp, tokenLength: providedToken.length });

    throw new HTTPException(401, { message: 'Invalid API key' });
  }

  // Use constant-time comparison
  if (!secureCompare(providedToken, validatedEnv.WORKER_API_KEY)) {
    logger.warn('Invalid API key attempt', {
      path,
      clientIp,
      userAgent: c.req.header('User-Agent'),
      // Log first few chars for debugging (if in dev)
      tokenPrefix: validatedEnv.NODE_ENV === 'development' ? providedToken.substring(0, 8) + '...' : undefined
    });

    throw new HTTPException(401, { message: 'Invalid API key' });
  }

  // Authentication successful
  logger.debug('Authentication successful', { path });

  // Add security headers for authenticated requests
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header(HEADERS.REQUEST_ID, c.get('requestId') || '');

  await next();
};
