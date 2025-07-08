// src/routes/svm.ts

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { svmAddressSchema, svmBalancesResponseSchema, svmQuerySchema, svmTransactionsResponseSchema } from '../schemas/svm';
import { proxyRequest } from '../utils/proxy';

export const svmRoutes = new Hono();

// SVM Transactions
svmRoutes.get(
  '/transactions/:address',
  zValidator('param', z.object({ address: svmAddressSchema })),
  zValidator('query', svmQuerySchema),
  async (c) => {
    const { address } = c.req.valid('param');
    const query = c.req.valid('query');
    const queryParams = new URLSearchParams();

    if (query.limit) queryParams.set('limit', query.limit.toString());
    if (query.offset) queryParams.set('offset', query.offset);

    return proxyRequest(c as any, `/beta/svm/transactions/${address}`, svmTransactionsResponseSchema, queryParams);
  }
);

// SVM Balances
svmRoutes.get(
  '/balances/:address',
  zValidator('param', z.object({ address: svmAddressSchema })),
  zValidator('query', svmQuerySchema),
  async (c) => {
    const { address } = c.req.valid('param');
    const query = c.req.valid('query');
    const queryParams = new URLSearchParams();

    if (query.chains) queryParams.set('chains', query.chains);
    if (query.limit) queryParams.set('limit', query.limit.toString());
    if (query.offset) queryParams.set('offset', query.offset);

    return proxyRequest(c as any, `/beta/svm/balances/${address}`, svmBalancesResponseSchema, queryParams);
  }
);
