// src/types/errors.ts

import { Data, ParseResult } from 'effect';
import { HTTPException } from 'hono/http-exception';

// ---------------------------------------------------------------------------
// Effect tagged errors — typed error channel for the proxy pipeline
// ---------------------------------------------------------------------------

/** Network/timeout errors produced by fetch */
export class FetchTimeoutError extends Data.TaggedError('FetchTimeoutError')<{
  readonly url: string;
  readonly timeoutMs: number;
}> {}

/** Any non-timeout network-level failure */
export class FetchNetworkError extends Data.TaggedError('FetchNetworkError')<{
  readonly url: string;
  readonly cause: unknown;
}> {}

/** Upstream returned a response body that failed Effect Schema validation */
export class UpstreamSchemaError extends Data.TaggedError('UpstreamSchemaError')<{
  readonly message: string;
  readonly preview: string;
}> {}

/** Upstream returned a non-JSON body (or unparseable JSON) */
export class UpstreamParseError extends Data.TaggedError('UpstreamParseError')<{
  readonly preview: string;
}> {}

/** Request or response body exceeded the configured size limit */
export class BodyTooLargeError extends Data.TaggedError('BodyTooLargeError')<{
  readonly size: number;
  readonly limit: number;
  readonly source: 'request' | 'response';
}> {}

/** Subrequest limit reached for this request lifecycle */
export class SubrequestLimitError extends Data.TaggedError('SubrequestLimitError')<{
  readonly limit: number;
  readonly current: number;
}> {}

/** Union of all errors that can occur inside the proxy pipeline Effect */
export type ProxyError =
  | FetchTimeoutError
  | FetchNetworkError
  | UpstreamSchemaError
  | UpstreamParseError
  | BodyTooLargeError;

// ---------------------------------------------------------------------------
// Serialization helpers (used by logging infrastructure)
// ---------------------------------------------------------------------------

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
 * Convert any error type to a serializable format for logging.
 * Handles Effect tagged errors, ParseError, HTTPException, and plain Errors.
 */
export function serializeError(error: unknown, context?: ErrorContext): SerializedError {
  const timestamp = new Date().toISOString();

  // Handle Effect Schema ParseError
  if (error instanceof ParseResult.ParseError) {
    return {
      message: error.message,
      name: 'ParseError',
      stack: error.stack,
      timestamp,
      ...context
    };
  }

  // Handle Effect tagged errors (Data.TaggedError subclasses have a _tag property)
  if (
    error instanceof Error &&
    '_tag' in error &&
    typeof (error as { _tag: unknown })._tag === 'string'
  ) {
    const tagged = error as Error & { _tag: string };
    return {
      message: tagged.message,
      name: tagged._tag,
      stack: tagged.stack,
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

  return { message: String(error), name: 'UnknownError', timestamp, ...context };
}

/**
 * Create a standardized error response body
 */
export function createErrorResponse(
  error: unknown,
  context?: ErrorContext,
  isDevelopment = false
): { error: string; details?: unknown; requestId?: string } {
  const serialized = serializeError(error, context);

  return {
    error: serialized.message,
    details: isDevelopment
      ? {
          name: serialized.name,
          ...(serialized.stack && { stack: serialized.stack }),
          ...(serialized.code && { code: serialized.code })
        }
      : undefined,
    requestId: context?.requestId
  };
}
