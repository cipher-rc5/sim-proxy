// src/config/env.ts

import { Schema } from 'effect';

const apiKeyPattern = /^[A-Za-z0-9+/\-_]+=*$/;

export const envSchema = Schema.Struct({
  DUNE_SIM_API_KEY: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'DUNE_SIM_API_KEY is required' }),
    Schema.pattern(apiKeyPattern, { message: () => 'Invalid API key format' })
  ),
  WORKER_API_KEY: Schema.String.pipe(
    Schema.minLength(32, { message: () => 'WORKER_API_KEY must be at least 32 characters' }),
    Schema.pattern(apiKeyPattern, { message: () => 'Invalid API key format' })
  ),
  NODE_ENV: Schema.optionalWith(
    Schema.Literal('development', 'production', 'test'),
    { default: () => 'production' as const }
  ),
  ALLOWED_ORIGINS: Schema.optional(
    Schema.String.pipe(
      Schema.filter(
        (val) => {
          const origins = val.split(',').map(o => o.trim()).filter(Boolean);
          return origins.every(o => o === '*' || /^https?:\/\/.+/.test(o));
        },
        { message: () => 'Invalid origin format: each origin must be "*" or start with http:// or https://' }
      )
    )
  )
});

// Type for the validated environment
export type ValidatedEnv = Schema.Schema.Type<typeof envSchema>;

// Additional runtime validations that depend on bindings
export function validateRuntimeEnv(env: ValidatedEnv, bindings: { RATE_LIMITER?: unknown }): void {
  if (env.NODE_ENV === 'production' && !bindings.RATE_LIMITER) {
    console.warn('[SECURITY WARNING] Rate limiter KV namespace not configured in production environment');
  }

  if (env.NODE_ENV === 'production' && env.ALLOWED_ORIGINS?.includes('*')) {
    throw new Error('ALLOWED_ORIGINS must not contain wildcard (*) in production');
  }
}

// Helper to parse allowed origins
export function parseAllowedOrigins(allowedOrigins?: string): string[] {
  if (!allowedOrigins) return [];
  return allowedOrigins.split(',').map(o => o.trim()).filter(Boolean);
}
