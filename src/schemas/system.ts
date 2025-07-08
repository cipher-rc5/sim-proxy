// src/schemas/system.ts

import { z } from 'zod';

export const healthSchema = z.object({
  status: z.literal('healthy'),
  timestamp: z.string().datetime(),
  version: z.string()
});
