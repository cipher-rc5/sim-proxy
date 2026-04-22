// src/routes/evm.ts

import { Schema } from 'effect';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { type ActivityResponse, activityResponseSchema, type BalancesResponse, balancesResponseSchema, chainsResponseSchema, collectiblesResponseSchema, defiPositionsResponseSchema, evmActivityQuerySchema, evmAddressSchema, evmBalancesQuerySchema, evmCollectiblesQuerySchema, evmDefiPositionsQuerySchema, evmStablecoinsQuerySchema, evmTokenHoldersQuerySchema, evmTokenInfoQuerySchema, evmTransactionsQuerySchema, stablecoinsResponseSchema, tokenHoldersResponseSchema, tokenInfoResponseSchema, type TransactionsResponse, transactionsResponseSchema } from '../schemas/evm';
import type { Variables } from '../types';
import { createLogger } from '../utils/logger';
import { proxyRequest } from '../utils/proxy';
import { schemaValidator } from '../utils/schema-validator';

export const evmRoutes = new Hono<{ Variables: Variables }>();

evmRoutes.get('/supported-chains/:uri/:extra', (c) => {
  const logger = createLogger(c);
  const { uri, extra } = c.req.param();

  logger.warn('Malformed supported-chains path', { uri, extra, path: c.req.path });

  return c.json({
    error: 'Malformed supported-chains path',
    hint: 'Use /v1/evm/supported-chains/{uri} (for example: /v1/evm/supported-chains/balances)'
  }, 400);
});

// Supported Chains endpoint
evmRoutes.get(
  '/supported-chains/:uri',
  schemaValidator(
    'param',
    Schema.Struct({
      uri: Schema.String.pipe(
        Schema.minLength(1, { message: () => 'URI parameter is required' }),
        Schema.pattern(/^[a-z\-]+$/, { message: () => 'Invalid URI format' })
      )
    })
  ),
  async (c) => {
    const logger = createLogger(c);
    const { uri } = c.req.valid('param');

    logger.info('Fetching supported chains', { uri });

    const knownUris = ['balances', 'transactions', 'activity', 'collectibles', 'stablecoins', 'defi-positions'];
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

// Collectibles endpoint
evmRoutes.get(
  '/collectibles/:address',
  schemaValidator('param', Schema.Struct({ address: evmAddressSchema })),
  schemaValidator('query', evmCollectiblesQuerySchema),
  async (c) => {
    const logger = createLogger(c);
    const { address: rawAddress } = c.req.valid('param');
    const address = rawAddress.toLowerCase();
    const query = c.req.valid('query');

    const queryParams = new URLSearchParams();
    if (query.chain_ids) queryParams.set('chain_ids', query.chain_ids);
    if (query.offset) queryParams.set('offset', query.offset);
    if (query.limit !== undefined) queryParams.set('limit', query.limit.toString());
    if (query.filter_spam !== undefined) queryParams.set('filter_spam', String(query.filter_spam));
    if (query.show_spam_scores !== undefined) queryParams.set('show_spam_scores', String(query.show_spam_scores));

    logger.info('Fetching EVM collectibles', {
      address: address.substring(0, 10) + '...',
      hasChainIds: !!query.chain_ids,
      filterSpam: query.filter_spam,
      showSpamScores: query.show_spam_scores,
      limit: query.limit,
      hasOffset: !!query.offset
    });

    return proxyRequest(c, `/v1/evm/collectibles/${address}`, collectiblesResponseSchema, queryParams);
  }
);

// Stablecoins endpoint
evmRoutes.get(
  '/stablecoins/:address',
  schemaValidator('param', Schema.Struct({ address: evmAddressSchema })),
  schemaValidator('query', evmStablecoinsQuerySchema),
  async (c) => {
    const { address: rawAddress } = c.req.valid('param');
    const address = rawAddress.toLowerCase();
    const query = c.req.valid('query');
    const queryParams = new URLSearchParams();

    if (query.chain_ids) queryParams.set('chain_ids', query.chain_ids);
    if (query.filters) queryParams.set('filters', query.filters);
    if (query.metadata) queryParams.set('metadata', query.metadata);
    if (query.exclude_spam_tokens !== undefined) {
      queryParams.set('exclude_spam_tokens', String(query.exclude_spam_tokens));
    }
    if (query.historical_prices) queryParams.set('historical_prices', query.historical_prices);
    if (query.limit !== undefined) queryParams.set('limit', query.limit.toString());
    if (query.offset) queryParams.set('offset', query.offset);

    return proxyRequest(c, `/v1/evm/balances/${address}/stablecoins`, stablecoinsResponseSchema, queryParams);
  }
);

// Token info endpoint
evmRoutes.get(
  '/token-info/:address',
  schemaValidator('param', Schema.Struct({ address: Schema.String.pipe(Schema.minLength(1)) })),
  schemaValidator('query', evmTokenInfoQuerySchema),
  async (c) => {
    const { address } = c.req.valid('param');
    const normalizedAddress = address.toLowerCase() === 'native' ? 'native' : address.toLowerCase();
    const query = c.req.valid('query');
    const queryParams = new URLSearchParams();

    queryParams.set('chain_ids', query.chain_ids);
    if (query.historical_prices) queryParams.set('historical_prices', query.historical_prices);
    if (query.limit !== undefined) queryParams.set('limit', query.limit.toString());
    if (query.offset) queryParams.set('offset', query.offset);

    return proxyRequest(c, `/v1/evm/token-info/${normalizedAddress}`, tokenInfoResponseSchema, queryParams);
  }
);

// Token holders endpoint
evmRoutes.get(
  '/token-holders/:chain_id/:address',
  schemaValidator(
    'param',
    Schema.Struct({
      chain_id: Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
      address: evmAddressSchema
    })
  ),
  schemaValidator('query', evmTokenHoldersQuerySchema),
  async (c) => {
    const { chain_id, address } = c.req.valid('param');
    const query = c.req.valid('query');
    const queryParams = new URLSearchParams();

    if (query.limit !== undefined) queryParams.set('limit', query.limit.toString());
    if (query.offset) queryParams.set('offset', query.offset);

    return proxyRequest(
      c,
      `/v1/evm/token-holders/${chain_id}/${address.toLowerCase()}`,
      tokenHoldersResponseSchema,
      queryParams
    );
  }
);

// DeFi positions endpoint (upstream beta path)
evmRoutes.get(
  '/defi-positions/:address',
  schemaValidator('param', Schema.Struct({ address: evmAddressSchema })),
  schemaValidator('query', evmDefiPositionsQuerySchema),
  async (c) => {
    const { address: rawAddress } = c.req.valid('param');
    const address = rawAddress.toLowerCase();
    const query = c.req.valid('query');
    const queryParams = new URLSearchParams();

    if (query.chain_ids) queryParams.set('chain_ids', query.chain_ids);

    return proxyRequest(c, `/beta/evm/defi/positions/${address}`, defiPositionsResponseSchema, queryParams);
  }
);

// Transactions endpoint
evmRoutes.get(
  '/transactions/:address',
  schemaValidator('param', Schema.Struct({ address: evmAddressSchema })),
  schemaValidator('query', evmTransactionsQuerySchema),
  async (c) => {
    const logger = createLogger(c);
    const { address: rawAddress } = c.req.valid('param');
    const address = rawAddress.toLowerCase();
    const query = c.req.valid('query');

    logger.info('Fetching EVM transactions', {
      address: address.substring(0, 10) + '...',
      hasChainIds: !!query.chain_ids,
      limit: query.limit,
      hasOffset: !!query.offset
    });

    const queryParams = new URLSearchParams();

    if (query.chain_ids) {
      const chainIds = query.chain_ids.split(',').map(id => id.trim());
      if (chainIds.some(id => !id)) {
        throw new HTTPException(400, { message: 'Invalid chain_ids format' });
      }
      queryParams.set('chain_ids', chainIds.join(','));
    }

    if (query.limit !== undefined) queryParams.set('limit', query.limit.toString());
    if (query.offset) queryParams.set('offset', query.offset);

    try {
      const response = await proxyRequest(
        c,
        `/v1/evm/transactions/${address}`,
        transactionsResponseSchema,
        queryParams
      );

      const data = await response.clone().json() as TransactionsResponse;
      logger.info('Transactions fetched successfully', {
        address: address.substring(0, 10) + '...',
        transactionCount: data.transactions?.length ?? 0,
        hasNextOffset: !!data.next_offset
      });

      return response;
    } catch (error) {
      logger.error('Failed to fetch transactions', { address: address.substring(0, 10) + '...', error });
      throw error;
    }
  }
);

// Activity endpoint
evmRoutes.get(
  '/activity/:address',
  schemaValidator('param', Schema.Struct({ address: evmAddressSchema })),
  schemaValidator('query', evmActivityQuerySchema),
  async (c) => {
    const logger = createLogger(c);
    const { address: rawAddress } = c.req.valid('param');
    const address = rawAddress.toLowerCase();
    const query = c.req.valid('query');

    logger.info('Fetching EVM activity', {
      address: address.substring(0, 10) + '...',
      hasChainIds: !!query.chain_ids,
      hasTokenAddress: !!query.token_address,
      hasActivityType: !!query.activity_type,
      hasAssetType: !!query.asset_type,
      limit: query.limit,
      hasOffset: !!query.offset
    });

    const queryParams = new URLSearchParams();
    if (query.chain_ids) queryParams.set('chain_ids', query.chain_ids);
    if (query.token_address) queryParams.set('token_address', query.token_address);
    if (query.activity_type) queryParams.set('activity_type', query.activity_type);
    if (query.asset_type) queryParams.set('asset_type', query.asset_type);
    if (query.limit !== undefined) queryParams.set('limit', query.limit.toString());
    if (query.offset) queryParams.set('offset', query.offset);

    try {
      const response = await proxyRequest(c, `/v1/evm/activity/${address}`, activityResponseSchema, queryParams);
      const data = await response.clone().json() as ActivityResponse;

      logger.info('Activity fetched successfully', {
        address: address.substring(0, 10) + '...',
        activityCount: data.activity?.length ?? 0,
        warningCount: data.warnings?.length ?? 0,
        hasNextOffset: !!data.next_offset
      });

      return response;
    } catch (error) {
      logger.error('Failed to fetch activity', { address: address.substring(0, 10) + '...', error });
      throw error;
    }
  }
);

// Balances endpoint
evmRoutes.get(
  '/balances/:address',
  schemaValidator('param', Schema.Struct({ address: evmAddressSchema })),
  schemaValidator('query', evmBalancesQuerySchema),
  async (c) => {
    const logger = createLogger(c);
    const { address: rawAddress } = c.req.valid('param');
    const address = rawAddress.toLowerCase();
    const query = c.req.valid('query');

    logger.info('Fetching EVM balances', {
      address: address.substring(0, 10) + '...',
      hasChainIds: !!query.chain_ids,
      filter: query.filters,
      metadata: query.metadata,
      limit: query.limit
    });

    const queryParams = new URLSearchParams();

    if (query.chain_ids) {
      const chainIds = query.chain_ids.split(',').map(id => id.trim());
      if (chainIds.some(id => !id)) {
        throw new HTTPException(400, { message: 'Invalid chain_ids format' });
      }
      queryParams.set('chain_ids', chainIds.join(','));
    }

    if (query.filters) queryParams.set('filters', query.filters);
    if (query.exclude_spam_tokens !== undefined) {
      queryParams.set('exclude_spam_tokens', String(query.exclude_spam_tokens));
    }
    if (query.historical_prices) queryParams.set('historical_prices', query.historical_prices);

    if (query.metadata) {
      const metadataFields = query.metadata.split(',').map(f => f.trim());
      const validFields = ['url', 'logo', 'description', 'social', 'pools'];
      const invalidFields = metadataFields.filter(f => !validFields.includes(f));

      if (invalidFields.length > 0) {
        logger.warn('Invalid metadata fields requested', { invalidFields });
      }

      queryParams.set('metadata', metadataFields.join(','));
    }

    if (query.limit !== undefined) queryParams.set('limit', query.limit.toString());
    if (query.offset) queryParams.set('offset', query.offset);

    try {
      const response = await proxyRequest(c, `/v1/evm/balances/${address}`, balancesResponseSchema, queryParams);

      const data = await response.clone().json() as BalancesResponse;
      logger.info('Balances fetched successfully', {
        address: address.substring(0, 10) + '...',
        balanceCount: data.balances?.length ?? 0,
        totalUsdValue: data.total_usd_value,
        chainCount: data.chain_count,
        hasNextOffset: !!data.next_offset
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
