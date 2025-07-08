// src/middleware/env.ts

import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { envSchema, validateRuntimeEnv } from '../config/env';
import type { Env, Variables } from '../types';

export const envMiddleware = async (c: Context<{ Bindings: Env, Variables: Variables }>, next: Next) => {
  try {
    // Validate environment variables
    const validatedEnv = envSchema.parse(c.env);

    // Store in context for other middleware/handlers
    c.set('validatedEnv', validatedEnv);

    // Perform runtime validations
    validateRuntimeEnv(validatedEnv, c.env);

    await next();
  } catch (error) {
    // Environment validation is critical - log to console since logger isn't available yet
    if (error instanceof z.ZodError) {
      console.error(
        '[ENV VALIDATION ERROR]',
        JSON.stringify({ errors: error.errors, timestamp: new Date().toISOString() })
      );

      // In development, expose validation errors
      if (c.env.NODE_ENV === 'development') {
        throw new HTTPException(500, {
          message: 'Invalid environment configuration',
          cause: {
            errors: error.errors.map(err => ({ path: err.path.join('.'), message: err.message, code: err.code }))
          }
        });
      }

      // In production, hide details
      throw new HTTPException(500, { message: 'Invalid environment configuration' });
    }

    console.error('[ENV VALIDATION ERROR] Unexpected error:', error);
    throw new HTTPException(500, { message: 'Failed to validate environment' });
  }
};
