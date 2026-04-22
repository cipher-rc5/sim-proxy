// src/routes/system.ts

import { Hono } from 'hono';
import { Schema } from 'effect';
import { API_VERSION, HEADERS } from '../config/constants';
import { healthSchema } from '../schemas/system';
import type { Variables } from '../types';

export const systemRoutes = new Hono<{ Variables: Variables }>();

systemRoutes.get('/health', (c) => {
  const response = Schema.decodeUnknownSync(healthSchema)({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: API_VERSION
  });

  c.header(HEADERS.CACHE_CONTROL, 'no-cache, no-store, must-revalidate');
  c.header(HEADERS.REQUEST_ID, c.get('requestId') || '');

  return c.json(response);
});
