// src/utils/logger.ts

import type { Context } from 'hono';
import type { ValidatedEnv } from '../config/env';
import type { LogContext } from '../types';
import { serializeError } from '../types/errors';

// Pino-like log levels
const LOG_LEVELS = { debug: 20, info: 30, warn: 40, error: 50 } as const;

type LogLevel = keyof typeof LOG_LEVELS;

// Logger interface with strict typing
export interface Logger {
  debug(msg: string, context?: LogContext): void;
  info(msg: string, context?: LogContext): void;
  warn(msg: string, context?: LogContext): void;
  error(msg: string, context?: LogContext): void;
}

// Log object structure
interface LogObject {
  level: number;
  time: number;
  pid: number;
  hostname: string;
  reqId: string;
  msg: string;
  [key: string]: unknown;
}

// Sensitive field patterns for sanitization
const SENSITIVE_PATTERNS = [
  'authorization',
  'x-sim-api-key',
  'x-api-key',
  'api_key',
  'apikey',
  'password',
  'token',
  'secret',
  'private',
  'credential'
] as const;

// Sanitize sensitive data from logs
function sanitizeLogData(data: unknown, isDevelopment = false): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data !== 'object') return data;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item, isDevelopment));
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains sensitive patterns
    if (SENSITIVE_PATTERNS.some(pattern => lowerKey.includes(pattern))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Handle special cases
    if (key === 'error' && value) {
      // Serialize error objects properly
      sanitized[key] = serializeError(value);

      // Remove stack traces in production
      if (!isDevelopment && sanitized[key] && typeof sanitized[key] === 'object') {
        const errorObj = sanitized[key] as Record<string, unknown>;
        delete errorObj['stack'];
      }
    } else if (key === 'url' && typeof value === 'string') {
      // Sanitize URLs
      sanitized[key] = sanitizeUrl(value);
    } else if (typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeLogData(value, isDevelopment);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Sanitize URLs to remove sensitive query parameters
function sanitizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    const params = new URLSearchParams(url.search);

    for (const [key] of params) {
      if (SENSITIVE_PATTERNS.some(pattern => key.toLowerCase().includes(pattern))) {
        params.set(key, '[REDACTED]');
      }
    }

    url.search = params.toString();
    return url.toString();
  } catch {
    // Invalid URL, return as is
    return urlString;
  }
}

// Create a logger instance for a context
export function createLogger(c: Context): Logger {
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv | undefined;
  const isDevelopment = validatedEnv?.NODE_ENV === 'development';
  const requestId = c.get('requestId') || crypto.randomUUID();

  const log = (level: LogLevel, msg: string, context?: LogContext): void => {
    // Skip debug logs in production
    if (level === 'debug' && !isDevelopment) return;

    // Build log object
    const logObj: LogObject = {
      level: LOG_LEVELS[level],
      time: Date.now(),
      pid: 1, // Cloudflare Workers don't have process IDs
      hostname: 'cloudflare-worker',
      reqId: requestId,
      msg
    };

    // Add sanitized context
    if (context) {
      const sanitized = sanitizeLogData(context, isDevelopment);
      if (typeof sanitized === 'object' && sanitized !== null) {
        Object.assign(logObj, sanitized);
      }
    }

    // Output format based on environment
    if (isDevelopment) {
      // Pretty print in development
      const levelStr = level.toUpperCase().padEnd(5);
      const timeStr = new Date(logObj.time).toISOString();
      console.log(`[${timeStr}] ${levelStr} (${requestId}): ${msg}`);

      if (context && Object.keys(context).length > 0) {
        console.log(JSON.stringify(sanitizeLogData(context, true), null, 2));
      }
    } else {
      // Single-line JSON in production
      console.log(JSON.stringify(logObj));
    }
  };

  return {
    debug: (msg, context) => log('debug', msg, context),
    info: (msg, context) => log('info', msg, context),
    warn: (msg, context) => log('warn', msg, context),
    error: (msg, context) => log('error', msg, context)
  };
}

// Create a child logger with additional context
export function createChildLogger(parentLogger: Logger, additionalContext: LogContext): Logger {
  return {
    debug: (msg, context) => parentLogger.debug(msg, { ...additionalContext, ...context }),
    info: (msg, context) => parentLogger.info(msg, { ...additionalContext, ...context }),
    warn: (msg, context) => parentLogger.warn(msg, { ...additionalContext, ...context }),
    error: (msg, context) => parentLogger.error(msg, { ...additionalContext, ...context })
  };
}
