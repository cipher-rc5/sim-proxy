// src/routes/evm.ts

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { balancesResponseSchema, chainsResponseSchema, evmAddressSchema, evmBalancesQuerySchema, evmTransactionsQuerySchema, transactionsResponseSchema } from '../schemas/evm';
import type { Variables } from '../types';
import { createLogger } from '../utils/logger';
import { proxyRequest } from '../utils/proxy';

export const evmRoutes = new Hono<{ Variables: Variables }>();

// Middleware to normalize addresses
const normalizeAddress = async (c: any, next: any) => {
  if (c.req.param('address')) {
    // Normalize to lowercase for consistency
    c.req.param.address = c.req.param('address').toLowerCase();
  }
  await next();
};

// Supported Chains endpoint
evmRoutes.get(
  '/supported-chains/:uri',
  zValidator(
    'param',
    z.object({ uri: z.string().min(1, 'URI parameter is required').regex(/^[a-z\-]+$/, 'Invalid URI format') })
  ),
  async (c) => {
    const logger = createLogger(c);
    const { uri } = c.req.valid('param');

    logger.info('Fetching supported chains', { uri });

    // Validate known URIs
    const knownUris = ['balances', 'transactions', 'activity'];
    if (!knownUris.includes(uri)) {
      logger.warn('Unknown URI requested', { uri, knownUris });
    }

    try {
      return await proxyRequest(c, `/v1/evm/supported-chains/${uri}`, chainsResponseSchema);
    } catch (error) {
      logger.error('Failed to fetch supported chains', { uri, error });
      throw error;
    }
  }
);

// Transactions endpoint
evmRoutes.get(
  '/transactions/:address',
  normalizeAddress,
  zValidator('param', z.object({ address: evmAddressSchema })),
  zValidator('query', evmTransactionsQuerySchema),
  async (c) => {
    const logger = createLogger(c);
    const { address } = c.req.valid('param');
    const query = c.req.valid('query');

    logger.info('Fetching EVM transactions', {
      address: address.substring(0, 10) + '...', // Log partial address
      hasChainIds: !!query.chain_ids,
      limit: query.limit,
      hasOffset: !!query.offset
    });

    // Build query parameters
    const queryParams = new URLSearchParams();

    if (query.chain_ids) {
      // Validate chain IDs format
      const chainIds = query.chain_ids.split(',').map(id => id.trim());
      if (chainIds.some(id => !id)) {
        throw new HTTPException(400, { message: 'Invalid chain_ids format' });
      }
      queryParams.set('chain_ids', chainIds.join(','));
    }

    if (query.limit !== undefined) {
      queryParams.set('limit', query.limit.toString());
    }

    if (query.offset) {
      queryParams.set('offset', query.offset);
    }

    try {
      const response = await proxyRequest(
        c,
        `/v1/evm/transactions/${address}`,
        transactionsResponseSchema,
        queryParams
      );

      // Log success metrics
      const data = await response.clone().json();
      logger.info('Transactions fetched successfully', {
        address: address.substring(0, 10) + '...',
        transactionCount: (data as any).transactions?.length || 0,
        hasNextOffset: !!(data as any).next_offset
      });

      return response;
    } catch (error) {
      logger.error('Failed to fetch transactions', { address: address.substring(0, 10) + '...', error });
      throw error;
    }
  }
);

// Balances endpoint
evmRoutes.get(
  '/balances/:address',
  normalizeAddress,
  zValidator('param', z.object({ address: evmAddressSchema })),
  zValidator('query', evmBalancesQuerySchema),
  async (c) => {
    const logger = createLogger(c);
    const { address } = c.req.valid('param');
    const query = c.req.valid('query');

    logger.info('Fetching EVM balances', {
      address: address.substring(0, 10) + '...',
      hasChainIds: !!query.chain_ids,
      filter: query.filters,
      metadata: query.metadata,
      limit: query.limit
    });

    // Build query parameters
    const queryParams = new URLSearchParams();

    if (query.chain_ids) {
      const chainIds = query.chain_ids.split(',').map(id => id.trim());
      if (chainIds.some(id => !id)) {
        throw new HTTPException(400, { message: 'Invalid chain_ids format' });
      }
      queryParams.set('chain_ids', chainIds.join(','));
    }

    if (query.filters) {
      queryParams.set('filters', query.filters);
    }

    if (query.metadata) {
      // Validate metadata fields
      const metadataFields = query.metadata.split(',').map(f => f.trim());
      const validFields = ['url', 'logo', 'description', 'social'];
      const invalidFields = metadataFields.filter(f => !validFields.includes(f));

      if (invalidFields.length > 0) {
        logger.warn('Invalid metadata fields requested', { invalidFields });
      }

      queryParams.set('metadata', metadataFields.join(','));
    }

    if (query.limit !== undefined) {
      queryParams.set('limit', query.limit.toString());
    }

    if (query.offset) {
      queryParams.set('offset', query.offset);
    }

    try {
      const response = await proxyRequest(c, `/v1/evm/balances/${address}`, balancesResponseSchema, queryParams);

      // Log success metrics
      const data = await response.clone().json();
      logger.info('Balances fetched successfully', {
        address: address.substring(0, 10) + '...',
        balanceCount: (data as any).balances?.length || 0,
        totalUsdValue: (data as any).total_usd_value,
        chainCount: (data as any).chain_count,
        hasNextOffset: !!(data as any).next_offset
      });

      return response;
    } catch (error) {
      logger.error('Failed to fetch balances', { address: address.substring(0, 10) + '...', error });
      throw error;
    }
  }
);

// Health check for EVM routes
evmRoutes.get('/health', (c) => {
  return c.json({ status: 'healthy', service: 'evm-routes', timestamp: new Date().toISOString() });
});
