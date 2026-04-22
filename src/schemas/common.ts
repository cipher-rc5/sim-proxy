// src/schemas/common.ts

import { Schema } from 'effect';

export const errorSchema = Schema.Struct({
  error: Schema.String,
  details: Schema.optional(
    Schema.Union(
      Schema.String,
      Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      Schema.Array(Schema.Unknown)
    )
  ),
  requestId: Schema.optional(Schema.String)
});

export const warningSchema = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  chain_ids: Schema.optional(Schema.Array(Schema.Number)),
  docs_url: Schema.optional(Schema.String)
});

export const paginationQuerySchema = Schema.Struct({
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.filter(n =>
    n >= 1 && n <= 1000, {
    message: () => 'limit must be between 1 and 1000'
  }))),
  offset: Schema.optional(Schema.String)
});

// Define types instead of using any
export type HttpStatus = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503;
