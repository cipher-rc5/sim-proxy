// src/config/env.ts

import { z } from 'zod';

// Base environment schema
const baseEnvSchema = z.object({
  DUNE_SIM_API_KEY: z.string().min(1, 'DUNE_SIM_API_KEY is required').regex(
    /^[A-Za-z0-9+/\-_]+=*$/,
    'Invalid API key format'
  ),
  WORKER_API_KEY: z.string().min(32, 'WORKER_API_KEY must be at least 32 characters').regex(
    /^[A-Za-z0-9+/\-_]+=*$/,
    'Invalid API key format'
  ),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  ALLOWED_ORIGINS: z.string().optional().transform((val) => {
    // Transform comma-separated string to array and validate each origin
    if (!val) return undefined;
    const origins = val.split(',').map(o => o.trim()).filter(Boolean);
    origins.forEach(origin => {
      if (origin !== '*' && !origin.match(/^https?:\/\/.+/)) {
        throw new Error(`Invalid origin format: ${origin}`);
      }
    });
    return val;
  })
});

// Export the schema for environment validation
export const envSchema = baseEnvSchema;

// Type for the validated environment
export type ValidatedEnv = z.infer<typeof envSchema>;

// Additional runtime validations that depend on bindings
export function validateRuntimeEnv(env: ValidatedEnv, bindings: { RATE_LIMITER?: unknown }): void {
  // In production, rate limiter should be available
  if (env.NODE_ENV === 'production' && !bindings.RATE_LIMITER) {
    console.warn('[SECURITY WARNING] Rate limiter KV namespace not configured in production environment');
  }
}

// Helper to parse allowed origins
export function parseAllowedOrigins(allowedOrigins?: string): string[] {
  if (!allowedOrigins) return ['*'];
  return allowedOrigins.split(',').map(o => o.trim()).filter(Boolean);
}
