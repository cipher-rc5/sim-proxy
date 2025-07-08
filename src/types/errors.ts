// src/types/errors.ts

import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

/**
 * Serializable error format for logging
 */
export interface SerializedError {
  message: string;
  name: string;
  stack?: string;
  code?: string;
  cause?: unknown;
  status?: number;
  zodErrors?: z.ZodIssue[];
  path?: string;
  method?: string;
  timestamp?: string;
}

/**
 * Type-safe error context for logging
 */
export interface ErrorContext {
  path?: string;
  method?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Convert any error type to a serializable format
 */
export function serializeError(error: unknown, context?: ErrorContext): SerializedError {
  const timestamp = new Date().toISOString();

  // Handle Zod errors specially
  if (error instanceof z.ZodError) {
    return {
      message: 'Validation failed',
      name: 'ZodError',
      zodErrors: error.errors,
      stack: error.stack,
      timestamp,
      ...context
    };
  }

  // Handle HTTPException
  if (error instanceof HTTPException) {
    return {
      message: error.message,
      name: 'HTTPException',
      status: error.status,
      stack: error.stack,
      cause: error.cause,
      timestamp,
      ...context
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const serialized: SerializedError = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause,
      timestamp,
      ...context
    };

    // Extract additional properties from error objects
    if ('code' in error && typeof error.code === 'string') {
      serialized.code = error.code;
    }

    return serialized;
  }

  // Handle error-like objects
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return {
      message: String(error.message),
      name: 'name' in error ? String(error.name) : 'UnknownError',
      stack: 'stack' in error ? String(error.stack) : undefined,
      status: 'status' in error && typeof error.status === 'number' ? error.status : undefined,
      timestamp,
      ...context
    };
  }

  // Fallback for non-error types
  return { message: String(error), name: 'UnknownError', timestamp, ...context };
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  context?: ErrorContext,
  isDevelopment = false
): { error: string, details?: unknown, requestId?: string } {
  const serialized = serializeError(error, context);

  return {
    error: serialized.message,
    details: isDevelopment ?
      {
        name: serialized.name,
        ...(serialized.zodErrors && { validationErrors: serialized.zodErrors }),
        ...(serialized.stack && { stack: serialized.stack }),
        ...(serialized.code && { code: serialized.code })
      } :
      undefined,
    requestId: context?.requestId
  };
}
