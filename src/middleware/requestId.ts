// src/middleware/requestId.ts

import type { Context, Next } from 'hono';
import { HEADERS } from '../config/constants';

export const requestIdMiddleware = async (c: Context, next: Next) => {
  // Generate unique request ID
  const requestId = crypto.randomUUID();

  // Store in context for other middleware/handlers
  c.set('requestId', requestId);

  // Add to response headers
  c.header(HEADERS.REQUEST_ID, requestId);

  await next();
};
