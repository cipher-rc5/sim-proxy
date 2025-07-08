// src/types/index.ts

import { z } from 'zod';
import { envSchema } from '../config/env';

// Re-export error types
export * from './errors';

// Cloudflare Worker bindings with proper types
export interface Env extends z.infer<typeof envSchema> {
  RATE_LIMITER?: KVNamespace; // Optional for development, required for production
}

// Context variables with strict typing
export interface Variables {
  validatedEnv: z.infer<typeof envSchema>;
  requestId: string;
  subrequestCount: number;
}

// Rate limit data structure
export interface RateLimitData {
  count: number;
  resetTime: number;
}

// Logger types for better type safety
export interface LogContext extends Record<string, unknown> {
  path?: string;
  method?: string;
  status?: number;
  error?: unknown;
  requestId?: string;
  clientIp?: string;
  responseTime?: number;
  responseSize?: number;
}

// API Response types
export interface APIResponse<T = unknown> {
  data?: T;
  error?: string;
  details?: unknown;
  requestId?: string;
}

// Proxy configuration
export interface ProxyConfig {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

// Request metadata for tracking
export interface RequestMetadata {
  startTime: number;
  path: string;
  method: string;
  clientIp?: string;
  userAgent?: string;
}
