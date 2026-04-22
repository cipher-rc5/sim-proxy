// src/schemas/system.ts

import { Schema } from 'effect';

export const healthSchema = Schema.Struct({
  status: Schema.Literal('healthy'),
  timestamp: Schema.String,
  version: Schema.String
});
