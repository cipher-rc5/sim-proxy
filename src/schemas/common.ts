// src/schemas/common.ts

import { z } from 'zod';

export const errorSchema = z.object({
  error: z.string(),
  details: z.union([z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional(),
  requestId: z.string().optional()
});

export const warningSchema = z.object({
  code: z.string(),
  message: z.string(),
  chain_ids: z.array(z.number()).optional(),
  docs_url: z.string().url().optional()
}).passthrough();

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(1000).optional(),
  offset: z.string().optional()
});

// Define types instead of using any
export type HttpStatus = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503;
