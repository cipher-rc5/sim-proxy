// src/routes/svm.ts

import { Schema } from 'effect';
import { Hono } from 'hono';
import { svmAddressSchema, svmBalancesResponseSchema, svmQuerySchema, svmTransactionsResponseSchema } from '../schemas/svm';
import type { Variables } from '../types';
import { proxyRequest } from '../utils/proxy';
import { schemaValidator } from '../utils/schema-validator';

export const svmRoutes = new Hono<{ Variables: Variables }>();

// SVM Transactions
svmRoutes.get(
  '/transactions/:address',
  schemaValidator('param', Schema.Struct({ address: svmAddressSchema })),
  schemaValidator('query', svmQuerySchema),
  async (c) => {
    const { address } = c.req.valid('param');
    const query = c.req.valid('query');
    const queryParams = new URLSearchParams();

    if (query.limit) queryParams.set('limit', query.limit.toString());
    if (query.offset) queryParams.set('offset', query.offset);

    return proxyRequest(c, `/beta/svm/transactions/${address}`, svmTransactionsResponseSchema, queryParams);
  }
);

// SVM Balances
svmRoutes.get(
  '/balances/:address',
  schemaValidator('param', Schema.Struct({ address: svmAddressSchema })),
  schemaValidator('query', svmQuerySchema),
  async (c) => {
    const { address } = c.req.valid('param');
    const query = c.req.valid('query');
    const queryParams = new URLSearchParams();

    if (query.chains) queryParams.set('chains', query.chains);
    if (query.limit) queryParams.set('limit', query.limit.toString());
    if (query.offset) queryParams.set('offset', query.offset);

    return proxyRequest(c, `/beta/svm/balances/${address}`, svmBalancesResponseSchema, queryParams);
  }
);
