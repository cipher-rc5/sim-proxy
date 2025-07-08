// src/routes/system.ts

import { Hono } from 'hono';
import { API_VERSION, HEADERS } from '../config/constants';
import { healthSchema } from '../schemas/system';
import type { Variables } from '../types';

export const systemRoutes = new Hono<{ Variables: Variables }>();

systemRoutes.get('/health', (c) => {
  const response = healthSchema.parse({ status: 'healthy', timestamp: new Date().toISOString(), version: API_VERSION });

  // Add cache headers for health checks
  c.header(HEADERS.CACHE_CONTROL, 'no-cache, no-store, must-revalidate');

  // Add request ID for tracking
  c.header(HEADERS.REQUEST_ID, c.get('requestId') || '');

  return c.json(response);
});
