// src/utils/schema-validator.ts

import { Schema } from 'effect';
import type { ValidationTargets } from 'hono';
import { validator } from 'hono/validator';

/**
 * Hono validator middleware backed by Effect Schema.
 * Replaces `zValidator` from `@hono/zod-validator`.
 * On validation failure, responds 400 with `{ error: string }`.
 * On success, stores the decoded value via `c.req.valid(target)`.
 *
 * Two type parameters allow schemas where Encoded ≠ Decoded
 * (e.g. `NumberFromString`, `BooleanFromString`).
 */
export function schemaValidator<T extends keyof ValidationTargets, A, I>(target: T, schema: Schema.Schema<A, I>) {
  return validator(target, (value, c) => {
    const result = Schema.decodeUnknownEither(schema)(value);
    if (result._tag === 'Left') {
      return c.json({ error: result.left.message }, 400);
    }
    return result.right;
  });
}
