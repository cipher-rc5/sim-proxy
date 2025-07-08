// src/middleware/error.ts

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { HEADERS } from '../config/constants';
import type { ValidatedEnv } from '../config/env';
import type { Variables } from '../types';
import { createErrorResponse, serializeError } from '../types/errors';
import { createLogger } from '../utils/logger';

// Error response interface
interface ErrorResponse {
  error: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

export const errorHandler = (err: Error, c: Context<{ Variables: Variables }>): Response => {
  const logger = createLogger(c);
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv | undefined;
  const isDevelopment = validatedEnv?.NODE_ENV === 'development';
  const requestId = c.get('requestId');

  // Create error context
  const errorContext = {
    path: c.req.path,
    method: c.req.method,
    requestId,
    userAgent: c.req.header('User-Agent'),
    clientIp: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')
  };

  // Log error with full context
  logger.error('Request failed', {
    error: serializeError(err, errorContext),
    status: err instanceof HTTPException ? err.status : 500
  });

  // Handle different error types using createErrorResponse
  let status = 500;
  let response: ErrorResponse;

  if (err instanceof HTTPException) {
    status = err.status;
    const errorResponse = createErrorResponse(err, errorContext, isDevelopment);
    response = { ...errorResponse, timestamp: new Date().toISOString() };
  } else if (err instanceof z.ZodError) {
    status = 400;
    const formattedErrors = err.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
      code: e.code,
      ...(isDevelopment && 'expected' in e ? { expected: e.expected } : {}),
      ...(isDevelopment && 'received' in e ? { received: e.received } : {})
    }));

    // Use createErrorResponse for consistency
    const errorResponse = createErrorResponse(new Error('Validation error'), errorContext, isDevelopment);

    response = {
      ...errorResponse,
      details: isDevelopment ?
        { errors: formattedErrors, errorCount: formattedErrors.length } :
        'Invalid request format',
      timestamp: new Date().toISOString()
    };
  } else {
    // Generic error handling using createErrorResponse
    const errorResponse = createErrorResponse(err, errorContext, isDevelopment);
    response = { ...errorResponse, timestamp: new Date().toISOString() };
  }

  // Set security headers
  const headers = new Headers({
    [HEADERS.CONTENT_TYPE]: 'application/json',
    [HEADERS.CONTENT_TYPE_OPTIONS]: 'nosniff',
    [HEADERS.FRAME_OPTIONS]: 'DENY',
    [HEADERS.REQUEST_ID]: requestId || ''
  });

  // Add cache control for errors
  if (status >= 500) {
    headers.set(HEADERS.CACHE_CONTROL, 'no-store');
  } else {
    headers.set(HEADERS.CACHE_CONTROL, 'no-cache');
  }

  return new Response(JSON.stringify(response), { status, headers });
};

// Not found handler
export const notFoundHandler = (c: Context<{ Variables: Variables }>): Response => {
  const logger = createLogger(c);
  const requestId = c.get('requestId');
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv | undefined;
  const isDevelopment = validatedEnv?.NODE_ENV === 'development';

  const errorContext = {
    path: c.req.path,
    method: c.req.method,
    requestId,
    userAgent: c.req.header(HEADERS.USER_AGENT)
  };

  logger.warn('Route not found', errorContext);

  // Use createErrorResponse for consistency
  const errorResponse = createErrorResponse(
    new Error(`Route ${c.req.method} ${c.req.path} not found`),
    errorContext,
    isDevelopment
  );

  const response: ErrorResponse = { ...errorResponse, error: 'Not Found', timestamp: new Date().toISOString() };

  return new Response(JSON.stringify(response), {
    status: 404,
    headers: {
      [HEADERS.CONTENT_TYPE]: 'application/json',
      [HEADERS.CONTENT_TYPE_OPTIONS]: 'nosniff',
      [HEADERS.REQUEST_ID]: requestId || ''
    }
  });
};
