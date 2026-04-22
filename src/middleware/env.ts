// src/middleware/env.ts

import { ParseResult, Schema } from 'effect';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { envSchema, validateRuntimeEnv } from '../config/env';
import type { Env, Variables } from '../types';

export const envMiddleware = async (c: Context<{ Bindings: Env, Variables: Variables }>, next: Next) => {
  try {
    const validatedEnv = Schema.decodeUnknownSync(envSchema)(c.env);

    c.set('validatedEnv', validatedEnv);
    validateRuntimeEnv(validatedEnv, c.env);

    await next();
  } catch (error) {
    if (error instanceof ParseResult.ParseError) {
      console.error(
        '[ENV VALIDATION ERROR]',
        JSON.stringify({ error: error.message, timestamp: new Date().toISOString() })
      );

      if (c.env.NODE_ENV === 'development') {
        throw new HTTPException(500, { message: 'Invalid environment configuration', cause: { error: error.message } });
      }

      throw new HTTPException(500, { message: 'Invalid environment configuration' });
    }

    console.error('[ENV VALIDATION ERROR] Unexpected error:', error);
    throw new HTTPException(500, { message: 'Failed to validate environment' });
  }
};
