# Directory Structure
```
config/
  constants.ts
  env.ts
  openapi.ts
middleware/
  auth.ts
  env.ts
  error.ts
  rateLimit.ts
  requestId.ts
routes/
  evm.ts
  svm.ts
  system.ts
schemas/
  common.ts
  evm.ts
  svm.ts
  system.ts
types/
  errors.ts
  index.ts
utils/
  fetch.ts
  logger.ts
  proxy.ts
index.ts
```

# Files

## File: config/constants.ts
````typescript
// src/config/constants.ts

// API Configuration
export const DUNE_SIM_BASE_ENDPOINT = 'https://api.sim.dune.com' as const;
export const API_VERSION = '1.0.0' as const;

// Cloudflare Worker Limits
export const MAX_RESPONSE_SIZE = 24 * 1024 * 1024; // 24MB (leaving 1MB buffer from 25MB limit)
export const MAX_SUBREQUESTS = 45; // Leave buffer from 50 limit
export const MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024; // 10MB request body limit

// Public paths that don't require authentication
export const PUBLIC_PATHS = ['/health', '/docs', '/scalar', '/openapi.json', '/llms.txt'] as const;

// Rate limiting defaults
export const RATE_LIMIT_DEFAULTS = {
  API_REQUESTS: 100,
  API_WINDOW: '1m',
  BETA_REQUESTS: 50,
  BETA_WINDOW: '1m',
  DOCS_REQUESTS: 200,
  DOCS_WINDOW: '1h'
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // 1 second
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_MULTIPLIER: 2,
  // Status codes that should not be retried
  NON_RETRYABLE_STATUS: new Set([
    400, // Bad Request
    401, // Unauthorized
    403, // Forbidden
    404, // Not Found
    405, // Method Not Allowed
    409, // Conflict
    422, // Unprocessable Entity
    501, // Not Implemented
    505 // HTTP Version Not Supported
  ])
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  SUPPORTED_CHAINS_TTL: 3600, // 1 hour
  SUPPORTED_CHAINS_STALE_TTL: 86400, // 24 hours
  DOCUMENTATION_TTL: 3600, // 1 hour
  DEFAULT_TTL: 0 // No cache by default
} as const;

// Request deduplication
export const DEDUP_CONFIG = {
  CLEANUP_DELAY: 500, // 500ms cleanup delay
  MAX_CONCURRENT_IDENTICAL: 1 // Max identical requests in flight
} as const;

// Headers configuration
export const HEADERS = {
  // Request headers
  API_KEY: 'X-Sim-Api-Key',
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',

  // Custom headers
  REQUEST_ID: 'X-Request-ID',

  // Rate limit headers
  RATE_LIMIT_LIMIT: 'X-RateLimit-Limit',
  RATE_LIMIT_REMAINING: 'X-RateLimit-Remaining',
  RATE_LIMIT_RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After',

  // Security headers
  CONTENT_TYPE_OPTIONS: 'X-Content-Type-Options',
  FRAME_OPTIONS: 'X-Frame-Options',
  XSS_PROTECTION: 'X-XSS-Protection',
  STRICT_TRANSPORT_SECURITY: 'Strict-Transport-Security',

  // Response headers
  RESPONSE_TIME: 'X-Response-Time',
  CACHE_CONTROL: 'Cache-Control'
} as const;

// Type helper for public paths
export type PublicPath = typeof PUBLIC_PATHS[number];
````

## File: config/env.ts
````typescript
// src/config/env.ts

import { z } from 'zod';

// Base environment schema
const baseEnvSchema = z.object({
  DUNE_SIM_API_KEY: z.string().min(1, 'DUNE_SIM_API_KEY is required').regex(
    /^[A-Za-z0-9+/\-_]+=*$/,
    'Invalid API key format'
  ),
  WORKER_API_KEY: z.string().min(32, 'WORKER_API_KEY must be at least 32 characters').regex(
    /^[A-Za-z0-9+/\-_]+=*$/,
    'Invalid API key format'
  ),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  ALLOWED_ORIGINS: z.string().optional().transform((val) => {
    // Transform comma-separated string to array and validate each origin
    if (!val) return undefined;
    const origins = val.split(',').map(o => o.trim()).filter(Boolean);
    origins.forEach(origin => {
      if (origin !== '*' && !origin.match(/^https?:\/\/.+/)) {
        throw new Error(`Invalid origin format: ${origin}`);
      }
    });
    return val;
  })
});

// Export the schema for environment validation
export const envSchema = baseEnvSchema;

// Type for the validated environment
export type ValidatedEnv = z.infer<typeof envSchema>;

// Additional runtime validations that depend on bindings
export function validateRuntimeEnv(env: ValidatedEnv, bindings: { RATE_LIMITER?: unknown }): void {
  // In production, rate limiter should be available
  if (env.NODE_ENV === 'production' && !bindings.RATE_LIMITER) {
    console.warn('[SECURITY WARNING] Rate limiter KV namespace not configured in production environment');
  }
}

// Helper to parse allowed origins
export function parseAllowedOrigins(allowedOrigins?: string): string[] {
  if (!allowedOrigins) return ['*'];
  return allowedOrigins.split(',').map(o => o.trim()).filter(Boolean);
}
````

## File: config/openapi.ts
````typescript
// src/config/openapi.ts

import { API_VERSION } from './constants.ts';

export const openAPISpec = {
  openapi: '3.1.0',
  info: {
    title: 'Dune Sim API Proxy',
    version: API_VERSION,
    description: `
A secure proxy for Dune Sim API with authentication and validation.

## Authentication
All endpoints (except documentation) require Bearer token authentication:
\`\`\`
Authorization: Bearer your_worker_api_key
\`\`\`

## Available Documentation
- Interactive API Reference: \`/docs\` or \`/scalar\`
- OpenAPI Specification: \`/openapi.json\`
- LLM-friendly Markdown: \`/llms.txt\`

## Rate Limiting
Please be mindful of rate limits imposed by the upstream Dune Sim API.
    `.trim(),
    contact: { name: 'API Support', email: 'support@example.com' },
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' }
  },
  servers: [{ url: 'https://your-worker.workers.dev', description: 'Production server' }, {
    url: 'http://localhost:8787',
    description: 'Local development server'
  }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'System', description: 'System endpoints for health checks and monitoring' },
    { name: 'EVM', description: 'Ethereum Virtual Machine endpoints for blockchain interactions' },
    { name: 'SVM', description: 'Solana Virtual Machine endpoints (Beta) for Solana blockchain' },
    { name: 'Documentation', description: 'API documentation endpoints' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'API Key', description: 'Enter your Worker API key' }
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string', description: 'Error message' },
          details: { type: 'object', description: 'Additional error details' }
        }
      },
      Health: {
        type: 'object',
        required: ['status', 'timestamp', 'version'],
        properties: {
          status: { type: 'string', enum: ['healthy'], description: 'Health status' },
          timestamp: { type: 'string', format: 'date-time', description: 'Current server time' },
          version: { type: 'string', description: 'API version' }
        }
      },
      ChainEntry: {
        type: 'object',
        required: ['id', 'name', 'tags'],
        properties: {
          id: { type: 'integer', description: 'Chain ID' },
          name: { type: 'string', description: 'Chain name' },
          supported_assets: { type: 'array', items: { type: 'string' }, description: 'Supported asset types' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Chain tags' },
          rpc_url: { type: 'string', nullable: true, description: 'RPC URL' },
          explorer_url: { type: 'string', nullable: true, description: 'Block explorer URL' },
          logo: { type: 'string', nullable: true, description: 'Chain logo URL' }
        }
      },
      ChainsResponse: {
        type: 'object',
        required: ['chains'],
        properties: { chains: { type: 'array', items: { $ref: '#/components/schemas/ChainEntry' } } }
      },
      Transaction: {
        type: 'object',
        required: ['address', 'block_hash', 'block_number', 'block_time', 'chain', 'from', 'hash'],
        properties: {
          address: { type: 'string', description: 'Wallet or contract address' },
          block_hash: { type: 'string', description: 'Block hash' },
          block_number: { type: 'string', description: 'Block number' },
          block_time: { type: 'string', description: 'Block timestamp' },
          block_version: { type: 'integer', description: 'Block version' },
          chain: { type: 'string', description: 'Chain name' },
          from: { type: 'string', description: 'Sender address' },
          to: { type: 'string', nullable: true, description: 'Receiver address' },
          data: { type: 'string', description: 'Transaction data' },
          gas_price: { type: 'string', nullable: true, description: 'Gas price (hex)' },
          hash: { type: 'string', description: 'Transaction hash' },
          index: { type: 'string', description: 'Transaction index' },
          max_fee_per_gas: { type: 'string', nullable: true, description: 'Max fee per gas (hex)' },
          max_priority_fee_per_gas: { type: 'string', nullable: true, description: 'Max priority fee per gas (hex)' },
          nonce: { type: 'string', description: 'Transaction nonce (hex)' },
          transaction_type: { type: 'string', description: 'Transaction type' },
          value: { type: 'string', description: 'Transaction value (hex)' }
        }
      },
      TransactionsResponse: {
        type: 'object',
        required: ['wallet_address', 'transactions'],
        properties: {
          wallet_address: { type: 'string', description: 'Queried wallet address' },
          transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
          errors: { type: 'object', nullable: true, description: 'Any errors encountered' },
          next_offset: { type: 'string', nullable: true, description: 'Pagination cursor' },
          request_time: { type: 'string', nullable: true, description: 'Request timestamp' },
          response_time: { type: 'string', nullable: true, description: 'Response timestamp' }
        }
      },
      BalanceData: {
        type: 'object',
        required: ['address', 'amount', 'chain'],
        properties: {
          address: { type: 'string', description: 'Token address or "native"' },
          amount: { type: 'string', description: 'Token amount' },
          chain: { type: 'string', description: 'Chain name' },
          chain_id: { type: 'integer', description: 'Chain ID' },
          decimals: { type: 'integer', nullable: true, description: 'Token decimals' },
          low_liquidity: { type: 'boolean', description: 'Low liquidity flag' },
          name: { type: 'string', nullable: true, description: 'Token name' },
          pool_size: { type: 'number', nullable: true, description: 'Liquidity pool size' },
          price_usd: { type: 'number', nullable: true, description: 'Price in USD' },
          symbol: { type: 'string', nullable: true, description: 'Token symbol' },
          token_metadata: {
            type: 'object',
            nullable: true,
            properties: {
              logo: { type: 'string', nullable: true, description: 'Token logo URL' },
              url: { type: 'string', nullable: true, description: 'Token website URL' }
            }
          },
          value_usd: { type: 'number', nullable: true, description: 'Total value in USD' }
        }
      },
      BalancesResponse: {
        type: 'object',
        required: ['wallet_address', 'balances'],
        properties: {
          wallet_address: { type: 'string', description: 'Queried wallet address' },
          balances: { type: 'array', items: { $ref: '#/components/schemas/BalanceData' } },
          errors: { type: 'object', nullable: true, description: 'Any errors encountered' },
          next_offset: { type: 'string', description: 'Pagination cursor' },
          request_time: { type: 'string', nullable: true, description: 'Request timestamp' },
          response_time: { type: 'string', nullable: true, description: 'Response timestamp' }
        }
      },
      SvmTransaction: {
        type: 'object',
        required: ['address', 'block_slot', 'block_time', 'chain'],
        properties: {
          address: { type: 'string', description: 'Wallet address' },
          block_slot: { type: 'number', description: "Block's sequential index" },
          block_time: { type: 'number', description: 'Timestamp of block creation (in microseconds)' },
          chain: { type: 'string', description: 'Name of the blockchain' },
          raw_transaction: { type: 'object', description: 'Raw transaction data from the RPC node' }
        }
      },
      SvmTransactionsResponse: {
        type: 'object',
        required: ['transactions'],
        properties: {
          transactions: { type: 'array', items: { $ref: '#/components/schemas/SvmTransaction' } },
          next_offset: { type: 'string', nullable: true, description: 'Pagination cursor' }
        }
      },
      SvmBalanceItem: {
        type: 'object',
        required: ['chain', 'address', 'amount'],
        properties: {
          chain: { type: 'string', description: 'Name of blockchain' },
          address: { type: 'string', description: 'Token address or "native"' },
          amount: { type: 'string', description: 'Amount in smallest unit' },
          balance: { type: 'string', description: 'Formatted amount' },
          value_usd: { type: 'number', nullable: true, description: 'Value in USD' },
          program_id: { type: 'string', nullable: true, description: 'Program ID (SPL tokens)' },
          decimals: { type: 'number', nullable: true, description: 'Token decimals' },
          total_supply: { type: 'string', nullable: true, description: 'Total supply' },
          name: { type: 'string', nullable: true, description: 'Token name' },
          symbol: { type: 'string', nullable: true, description: 'Token symbol' },
          uri: { type: 'string', nullable: true, description: 'Metadata URI' },
          price_usd: { type: 'number', nullable: true, description: 'Price in USD' },
          liquidity_usd: { type: 'number', nullable: true, description: 'Liquidity in USD' },
          pool_type: { type: 'string', nullable: true, description: 'Pool type' },
          pool_address: { type: 'string', nullable: true, description: 'Pool address' },
          mint_authority: { type: 'string', nullable: true, description: 'Mint authority' }
        }
      },
      SvmBalancesResponse: {
        type: 'object',
        required: ['wallet_address', 'balances'],
        properties: {
          wallet_address: { type: 'string', description: 'Queried wallet address' },
          balances: { type: 'array', items: { $ref: '#/components/schemas/SvmBalanceItem' } },
          next_offset: { type: 'string', nullable: true, description: 'Pagination cursor' },
          processing_time_ms: { type: 'number', description: 'Processing time' },
          balances_count: { type: 'number', description: 'Number of balances' }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        description: 'Check if the API is healthy and operational',
        operationId: 'getHealth',
        security: [],
        tags: ['System'],
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Health' },
                example: { status: 'healthy', timestamp: '2024-01-01T00:00:00.000Z', version: '1.0.0' }
              }
            }
          }
        }
      }
    },
    '/docs': {
      get: {
        summary: 'Interactive API documentation',
        description: 'Scalar-powered interactive API documentation',
        operationId: 'getDocs',
        security: [],
        tags: ['Documentation'],
        responses: {
          '200': { description: 'HTML documentation page', content: { 'text/html': { schema: { type: 'string' } } } }
        }
      }
    },
    '/scalar': {
      get: {
        summary: 'Alternative API documentation endpoint',
        description: 'Alternative endpoint for Scalar API documentation',
        operationId: 'getScalar',
        security: [],
        tags: ['Documentation'],
        responses: {
          '200': { description: 'HTML documentation page', content: { 'text/html': { schema: { type: 'string' } } } }
        }
      }
    },
    '/openapi.json': {
      get: {
        summary: 'OpenAPI specification',
        description: 'Get the OpenAPI 3.1.0 specification for this API',
        operationId: 'getOpenAPISpec',
        security: [],
        tags: ['Documentation'],
        responses: {
          '200': {
            description: 'OpenAPI specification',
            content: { 'application/json': { schema: { type: 'object' } } }
          }
        }
      }
    },
    '/llms.txt': {
      get: {
        summary: 'LLM-friendly API documentation',
        description: 'Markdown-formatted API documentation optimized for Large Language Models',
        operationId: 'getLLMDocs',
        security: [],
        tags: ['Documentation'],
        responses: {
          '200': {
            description: 'Markdown documentation',
            content: {
              'text/plain': {
                schema: { type: 'string' },
                example: '# Dune Sim API Proxy\n\n## Endpoints\n\n### GET /health\n...'
              }
            }
          },
          '500': {
            description: 'Failed to generate documentation',
            content: { 'text/plain': { schema: { type: 'string' } } }
          }
        }
      }
    },
    '/v1/evm/supported-chains/{uri}': {
      get: {
        summary: 'Get supported chains',
        description: 'Get list of supported chains for a specific endpoint',
        operationId: 'getEvmSupportedChains',
        tags: ['EVM'],
        parameters: [{
          name: 'uri',
          in: 'path',
          required: true,
          description: 'Endpoint name (e.g., balances, transactions)',
          schema: { type: 'string' }
        }],
        responses: {
          '200': {
            description: 'List of supported chains',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ChainsResponse' } } }
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          },
          '500': {
            description: 'Internal server error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          }
        }
      }
    },
    '/v1/evm/transactions/{address}': {
      get: {
        summary: 'Get EVM transactions',
        description: 'Get transactions for an EVM address',
        operationId: 'getEvmTransactions',
        tags: ['EVM'],
        parameters: [{
          name: 'address',
          in: 'path',
          required: true,
          description: 'EVM address (0x...)',
          schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }, {
          name: 'chain_ids',
          in: 'query',
          description: 'Comma-separated chain IDs or tags',
          schema: { type: 'string' }
        }, {
          name: 'limit',
          in: 'query',
          description: 'Maximum number of results',
          schema: { type: 'integer', minimum: 1, maximum: 1000 }
        }, { name: 'offset', in: 'query', description: 'Pagination cursor', schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Transaction list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TransactionsResponse' } } }
          },
          '400': {
            description: 'Bad request',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          },
          '500': {
            description: 'Internal server error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          }
        }
      }
    },
    '/v1/evm/balances/{address}': {
      get: {
        summary: 'Get EVM balances',
        description: 'Get token balances for an EVM address',
        operationId: 'getEvmBalances',
        tags: ['EVM'],
        parameters: [
          {
            name: 'address',
            in: 'path',
            required: true,
            description: 'EVM address (0x...)',
            schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
          },
          {
            name: 'chain_ids',
            in: 'query',
            description: 'Comma-separated chain IDs or tags',
            schema: { type: 'string' }
          },
          {
            name: 'filters',
            in: 'query',
            description: 'Filter by token type',
            schema: { type: 'string', enum: ['erc20', 'native'] }
          },
          { name: 'metadata', in: 'query', description: 'Additional metadata fields', schema: { type: 'string' } },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of results',
            schema: { type: 'integer', minimum: 1, maximum: 1000 }
          },
          { name: 'offset', in: 'query', description: 'Pagination cursor', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Balance list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BalancesResponse' } } }
          },
          '400': {
            description: 'Bad request',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          },
          '500': {
            description: 'Internal server error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          }
        }
      }
    },
    '/beta/svm/transactions/{address}': {
      get: {
        summary: 'Get SVM transactions (Beta)',
        description: 'Get transactions for a Solana address',
        operationId: 'getSvmTransactions',
        tags: ['SVM'],
        parameters: [{
          name: 'address',
          in: 'path',
          required: true,
          description: 'Solana address',
          schema: { type: 'string', minLength: 32, maxLength: 44 }
        }, {
          name: 'limit',
          in: 'query',
          description: 'Maximum number of results',
          schema: { type: 'integer', minimum: 1, maximum: 1000, default: 100 }
        }, { name: 'offset', in: 'query', description: 'Pagination cursor', schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Transaction list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SvmTransactionsResponse' } } }
          },
          '400': {
            description: 'Bad request',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          },
          '500': {
            description: 'Internal server error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          }
        }
      }
    },
    '/beta/svm/balances/{address}': {
      get: {
        summary: 'Get SVM balances (Beta)',
        description: 'Get token balances for a Solana address',
        operationId: 'getSvmBalances',
        tags: ['SVM'],
        parameters: [{
          name: 'address',
          in: 'path',
          required: true,
          description: 'Solana address',
          schema: { type: 'string', minLength: 32, maxLength: 44 }
        }, {
          name: 'chains',
          in: 'query',
          description: 'Comma-separated chain names or "all"',
          schema: { type: 'string' }
        }, {
          name: 'limit',
          in: 'query',
          description: 'Maximum number of results',
          schema: { type: 'integer', minimum: 1, maximum: 1000, default: 100 }
        }, { name: 'offset', in: 'query', description: 'Pagination cursor', schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Balance list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SvmBalancesResponse' } } }
          },
          '400': {
            description: 'Bad request',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          },
          '500': {
            description: 'Internal server error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          }
        }
      }
    }
  }
};
````

## File: middleware/auth.ts
````typescript
// src/middleware/auth.ts

import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { HEADERS, PUBLIC_PATHS } from '../config/constants';
import type { ValidatedEnv } from '../config/env';
import type { Variables } from '../types';
import { createLogger } from '../utils/logger';

// Constant-time string comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0;i < a.length;i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

export const authMiddleware = async (c: Context<{ Variables: Variables }>, next: Next) => {
  const path = c.req.path;

  // Skip auth for public endpoints
  if (PUBLIC_PATHS.includes(path as any)) {
    // Add security headers even for public endpoints
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header(HEADERS.REQUEST_ID, c.get('requestId') || '');

    return next();
  }

  const logger = createLogger(c);
  const authHeader = c.req.header('Authorization');
  const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

  // Check for authorization header
  if (!authHeader) {
    logger.warn('Missing authorization header', { path, clientIp, userAgent: c.req.header('User-Agent') });

    throw new HTTPException(401, { message: 'Missing authorization header' });
  }

  // Validate Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('Invalid authorization header format', { path, clientIp, headerStart: authHeader.substring(0, 10) });

    throw new HTTPException(401, { message: 'Invalid authorization header format' });
  }

  const providedToken = authHeader.substring(7);
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv;

  // Validate token length
  if (providedToken.length < 32) {
    logger.warn('Token too short', { path, clientIp, tokenLength: providedToken.length });

    throw new HTTPException(401, { message: 'Invalid API key' });
  }

  // Use constant-time comparison
  if (!secureCompare(providedToken, validatedEnv.WORKER_API_KEY)) {
    logger.warn('Invalid API key attempt', {
      path,
      clientIp,
      userAgent: c.req.header('User-Agent'),
      // Log first few chars for debugging (if in dev)
      tokenPrefix: validatedEnv.NODE_ENV === 'development' ? providedToken.substring(0, 8) + '...' : undefined
    });

    throw new HTTPException(401, { message: 'Invalid API key' });
  }

  // Authentication successful
  logger.debug('Authentication successful', { path });

  // Add security headers for authenticated requests
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header(HEADERS.REQUEST_ID, c.get('requestId') || '');

  await next();
};
````

## File: middleware/env.ts
````typescript
// src/middleware/env.ts

import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { envSchema, validateRuntimeEnv } from '../config/env';
import type { Env, Variables } from '../types';

export const envMiddleware = async (c: Context<{ Bindings: Env, Variables: Variables }>, next: Next) => {
  try {
    // Validate environment variables
    const validatedEnv = envSchema.parse(c.env);

    // Store in context for other middleware/handlers
    c.set('validatedEnv', validatedEnv);

    // Perform runtime validations
    validateRuntimeEnv(validatedEnv, c.env);

    await next();
  } catch (error) {
    // Environment validation is critical - log to console since logger isn't available yet
    if (error instanceof z.ZodError) {
      console.error(
        '[ENV VALIDATION ERROR]',
        JSON.stringify({ errors: error.errors, timestamp: new Date().toISOString() })
      );

      // In development, expose validation errors
      if (c.env.NODE_ENV === 'development') {
        throw new HTTPException(500, {
          message: 'Invalid environment configuration',
          cause: {
            errors: error.errors.map(err => ({ path: err.path.join('.'), message: err.message, code: err.code }))
          }
        });
      }

      // In production, hide details
      throw new HTTPException(500, { message: 'Invalid environment configuration' });
    }

    console.error('[ENV VALIDATION ERROR] Unexpected error:', error);
    throw new HTTPException(500, { message: 'Failed to validate environment' });
  }
};
````

## File: middleware/error.ts
````typescript
// src/middleware/error.ts

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { HEADERS } from '../config/constants';
import type { ValidatedEnv } from '../config/env';
import type { Variables } from '../types';
import { createErrorResponse, serializeError } from '../types/errors';
import { createLogger } from '../utils/logger';

// Error response interface
interface ErrorResponse {
  error: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

export const errorHandler = (err: Error, c: Context<{ Variables: Variables }>): Response => {
  const logger = createLogger(c);
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv | undefined;
  const isDevelopment = validatedEnv?.NODE_ENV === 'development';
  const requestId = c.get('requestId');

  // Create error context
  const errorContext = {
    path: c.req.path,
    method: c.req.method,
    requestId,
    userAgent: c.req.header('User-Agent'),
    clientIp: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')
  };

  // Log error with full context
  logger.error('Request failed', {
    error: serializeError(err, errorContext),
    status: err instanceof HTTPException ? err.status : 500
  });

  // Handle different error types using createErrorResponse
  let status = 500;
  let response: ErrorResponse;

  if (err instanceof HTTPException) {
    status = err.status;
    const errorResponse = createErrorResponse(err, errorContext, isDevelopment);
    response = { ...errorResponse, timestamp: new Date().toISOString() };
  } else if (err instanceof z.ZodError) {
    status = 400;
    const formattedErrors = err.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
      code: e.code,
      ...(isDevelopment && 'expected' in e ? { expected: e.expected } : {}),
      ...(isDevelopment && 'received' in e ? { received: e.received } : {})
    }));

    // Use createErrorResponse for consistency
    const errorResponse = createErrorResponse(new Error('Validation error'), errorContext, isDevelopment);

    response = {
      ...errorResponse,
      details: isDevelopment ?
        { errors: formattedErrors, errorCount: formattedErrors.length } :
        'Invalid request format',
      timestamp: new Date().toISOString()
    };
  } else {
    // Generic error handling using createErrorResponse
    const errorResponse = createErrorResponse(err, errorContext, isDevelopment);
    response = { ...errorResponse, timestamp: new Date().toISOString() };
  }

  // Set security headers
  const headers = new Headers({
    [HEADERS.CONTENT_TYPE]: 'application/json',
    [HEADERS.CONTENT_TYPE_OPTIONS]: 'nosniff',
    [HEADERS.FRAME_OPTIONS]: 'DENY',
    [HEADERS.REQUEST_ID]: requestId || ''
  });

  // Add cache control for errors
  if (status >= 500) {
    headers.set(HEADERS.CACHE_CONTROL, 'no-store');
  } else {
    headers.set(HEADERS.CACHE_CONTROL, 'no-cache');
  }

  return new Response(JSON.stringify(response), { status, headers });
};

// Not found handler
export const notFoundHandler = (c: Context<{ Variables: Variables }>): Response => {
  const logger = createLogger(c);
  const requestId = c.get('requestId');
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv | undefined;
  const isDevelopment = validatedEnv?.NODE_ENV === 'development';

  const errorContext = {
    path: c.req.path,
    method: c.req.method,
    requestId,
    userAgent: c.req.header(HEADERS.USER_AGENT)
  };

  logger.warn('Route not found', errorContext);

  // Use createErrorResponse for consistency
  const errorResponse = createErrorResponse(
    new Error(`Route ${c.req.method} ${c.req.path} not found`),
    errorContext,
    isDevelopment
  );

  const response: ErrorResponse = { ...errorResponse, error: 'Not Found', timestamp: new Date().toISOString() };

  return new Response(JSON.stringify(response), {
    status: 404,
    headers: {
      [HEADERS.CONTENT_TYPE]: 'application/json',
      [HEADERS.CONTENT_TYPE_OPTIONS]: 'nosniff',
      [HEADERS.REQUEST_ID]: requestId || ''
    }
  });
};
````

## File: middleware/rateLimit.ts
````typescript
// src/middleware/rateLimit.ts

import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { HEADERS } from '../config/constants';
import type { Env, RateLimitData, Variables } from '../types';
import { serializeError } from '../types/errors';
import { createLogger } from '../utils/logger';

interface RateLimitOptions {
  requests: number;
  window: string; // e.g., '1m', '1h'
  keyPrefix?: string; // Custom prefix for rate limit keys
  skipIf?: (c: Context) => boolean; // Skip rate limiting conditionally
  onLimitExceeded?: (c: Context, data: RateLimitData) => void;
}

// Parse window string to milliseconds
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid rate limit window format: ${window}`);
  }

  const [, num, unit] = match;
  const multipliers = {
    s: 1000, // seconds
    m: 60000, // minutes
    h: 3600000, // hours
    d: 86400000 // days
  };

  return parseInt(num) * multipliers[unit as keyof typeof multipliers];
}

// Get client identifier for rate limiting
function getClientIdentifier(c: Context): string {
  // Priority: CF-Connecting-IP > X-Forwarded-For > X-Real-IP > fallback
  return c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0].trim() ||
    c.req.header('X-Real-IP') ||
    'anonymous';
}

export const rateLimiter = (options: RateLimitOptions) => {
  const windowMs = parseWindow(options.window);
  const windowSeconds = Math.ceil(windowMs / 1000);
  const keyPrefix = options.keyPrefix || 'rate_limit';

  return async (c: Context<{ Bindings: Env, Variables: Variables }>, next: Next) => {
    const logger = createLogger(c);

    // Check if we should skip rate limiting
    if (options.skipIf?.(c)) {
      logger.debug('Skipping rate limit check');
      return next();
    }

    const validatedEnv = c.get('validatedEnv');
    const kv = c.env.RATE_LIMITER;

    // In production, rate limiter must be configured
    if (!kv && validatedEnv.NODE_ENV === 'production') {
      logger.error('Rate limiter KV namespace not configured in production');
      throw new HTTPException(500, { message: 'Internal server error' });
    }

    // Skip if KV not available in development
    if (!kv) {
      logger.warn('Rate limiter KV namespace not configured, skipping rate limiting');
      return next();
    }

    const clientIp = getClientIdentifier(c);
    const key = `${keyPrefix}:${clientIp}:${c.req.path}`;
    const now = Date.now();

    try {
      // Get current rate limit data
      const data = await kv.get<RateLimitData>(key, 'json');

      if (!data || data.resetTime < now) {
        // New window or expired
        const newData: RateLimitData = { count: 1, resetTime: now + windowMs };

        // Store with expiration
        await kv.put(key, JSON.stringify(newData), { expirationTtl: windowSeconds });

        // Add rate limit headers
        c.header(HEADERS.RATE_LIMIT_LIMIT, options.requests.toString());
        c.header(HEADERS.RATE_LIMIT_REMAINING, (options.requests - 1).toString());
        c.header(HEADERS.RATE_LIMIT_RESET, Math.floor(newData.resetTime / 1000).toString());

        logger.debug('Rate limit window started', {
          clientIp,
          path: c.req.path,
          window: options.window,
          remaining: options.requests - 1
        });
      } else {
        // Existing window
        if (data.count >= options.requests) {
          // Rate limit exceeded
          const retryAfter = Math.ceil((data.resetTime - now) / 1000);

          logger.warn('Rate limit exceeded', {
            clientIp,
            path: c.req.path,
            count: data.count,
            limit: options.requests,
            retryAfter,
            userAgent: c.req.header(HEADERS.USER_AGENT)
          });

          // Set response headers
          c.header(HEADERS.RATE_LIMIT_LIMIT, options.requests.toString());
          c.header(HEADERS.RATE_LIMIT_REMAINING, '0');
          c.header(HEADERS.RATE_LIMIT_RESET, Math.floor(data.resetTime / 1000).toString());
          c.header(HEADERS.RETRY_AFTER, retryAfter.toString());

          // Call custom handler if provided
          options.onLimitExceeded?.(c, data);

          throw new HTTPException(429, {
            message: 'Rate limit exceeded',
            cause: {
              retryAfter,
              limit: options.requests,
              window: options.window,
              reset: new Date(data.resetTime).toISOString()
            }
          });
        }

        // Increment count
        data.count++;

        // Update in KV
        const ttl = Math.ceil((data.resetTime - now) / 1000);
        if (ttl > 0) {
          await kv.put(key, JSON.stringify(data), { expirationTtl: ttl });
        }

        // Add rate limit headers
        c.header(HEADERS.RATE_LIMIT_LIMIT, options.requests.toString());
        c.header(HEADERS.RATE_LIMIT_REMAINING, (options.requests - data.count).toString());
        c.header(HEADERS.RATE_LIMIT_RESET, Math.floor(data.resetTime / 1000).toString());
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      // Log KV errors
      logger.error('Rate limiter error', { error: serializeError(error), key, clientIp });

      // In production, fail closed (deny request)
      if (validatedEnv.NODE_ENV === 'production') {
        throw new HTTPException(500, { message: 'Internal server error' });
      }

      // In development, fail open (allow request)
      logger.warn('Rate limiter failed open in development mode');
    }

    await next();
  };
};

// Factory function for common rate limit configurations
export const createRateLimiter = {
  api: (overrides?: Partial<RateLimitOptions>) =>
    rateLimiter({ requests: 100, window: '1m', keyPrefix: 'api', ...overrides }),

  beta: (overrides?: Partial<RateLimitOptions>) =>
    rateLimiter({ requests: 50, window: '1m', keyPrefix: 'beta', ...overrides }),

  docs: (overrides?: Partial<RateLimitOptions>) =>
    rateLimiter({ requests: 200, window: '1h', keyPrefix: 'docs', ...overrides })
};
````

## File: middleware/requestId.ts
````typescript
// src/middleware/requestId.ts

import type { Context, Next } from 'hono';
import { HEADERS } from '../config/constants';

export const requestIdMiddleware = async (c: Context, next: Next) => {
  // Generate unique request ID
  const requestId = crypto.randomUUID();

  // Store in context for other middleware/handlers
  c.set('requestId', requestId);

  // Add to response headers
  c.header(HEADERS.REQUEST_ID, requestId);

  await next();
};
````

## File: routes/evm.ts
````typescript
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
````

## File: routes/svm.ts
````typescript
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
````

## File: routes/system.ts
````typescript
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
````

## File: schemas/common.ts
````typescript
// src/schemas/common.ts

import { z } from 'zod';

export const errorSchema = z.object({
  error: z.string(),
  details: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]).optional(),
  requestId: z.string().optional()
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(1000).optional(),
  offset: z.string().optional()
});

// Define types instead of using any
export type HttpStatus = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503;
````

## File: schemas/evm.ts
````typescript
// src/schemas/evm.ts

import { z } from 'zod';
import { paginationQuerySchema } from './common';

// EVM address validation
export const evmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address format');

// Chain entry schema
export const chainEntrySchema = z.object({
  id: z.number(),
  name: z.string(),
  supported_assets: z.array(z.string()).optional(),
  tags: z.array(z.string()),
  rpc_url: z.string().url().nullable().optional(),
  explorer_url: z.string().url().nullable().optional(),
  logo: z.string().url().nullable().optional()
});

export const chainsResponseSchema = z.object({ chains: z.array(chainEntrySchema) });

// Transaction schema - aligned with Dune Sim API
export const transactionSchema = z.object({
  address: z.string(),
  block_hash: z.string(),
  block_number: z.string(),
  block_time: z.string(), // ISO timestamp
  block_version: z.number().optional(),
  chain: z.string(),
  from: z.string(),
  to: z.string().nullable().optional(),
  data: z.string().optional(),
  gas: z.string().optional(), // Added - gas limit in hex
  gas_price: z.string().nullable().optional(),
  gas_used: z.string().optional(), // Added - actual gas used in hex
  hash: z.string(),
  index: z.string().optional(),
  max_fee_per_gas: z.string().nullable().optional(),
  max_priority_fee_per_gas: z.string().nullable().optional(),
  nonce: z.string().optional(),
  transaction_type: z.string().optional(),
  value: z.string().optional(),
  // Additional fields that might be present
  access_list: z.array(z.unknown()).optional(),
  y_parity: z.string().optional(),
  v: z.string().optional(),
  r: z.string().optional(),
  s: z.string().optional()
}).passthrough(); // Allow additional fields from the API

// Dune API error structure
export const duneErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional()
}).passthrough(); // Allow additional error fields

// Transactions response
export const transactionsResponseSchema = z.object({
  wallet_address: z.string(),
  transactions: z.array(transactionSchema),
  errors: z.union([duneErrorSchema, z.array(duneErrorSchema), z.null()]).optional(),
  next_offset: z.string().nullable().optional(),
  request_time: z.string().datetime().nullable().optional(),
  response_time: z.string().datetime().nullable().optional()
});

// Balance data schema
export const balanceDataSchema = z.object({
  address: z.string(), // Token contract address or "native"
  amount: z.string(), // Raw amount in smallest unit
  chain: z.string(),
  chain_id: z.number().optional(),
  decimals: z.number().nullable().optional(),
  low_liquidity: z.boolean().optional(),
  name: z.string().nullable().optional(),
  pool_size: z.number().nullable().optional(),
  price_usd: z.number().nullable().optional(),
  symbol: z.string().nullable().optional(),
  token_metadata: z.object({
    logo: z.string().url().nullable().optional(),
    url: z.string().url().nullable().optional(),
    // Additional metadata fields
    description: z.string().nullable().optional(),
    social: z.record(z.string().url()).optional()
  }).nullable().optional(),
  value_usd: z.number().nullable().optional(),
  // Additional balance fields
  last_transfer_timestamp: z.string().datetime().nullable().optional(),
  spam_score: z.number().min(0).max(1).nullable().optional()
}).passthrough();

// Balances response
export const balancesResponseSchema = z.object({
  wallet_address: z.string(),
  balances: z.array(balanceDataSchema),
  errors: z.union([duneErrorSchema, z.array(duneErrorSchema), z.null()]).optional(),
  next_offset: z.string().optional(), // Not nullable according to API
  request_time: z.string().datetime().nullable().optional(),
  response_time: z.string().datetime().nullable().optional(),
  // Additional response metadata
  total_usd_value: z.number().nullable().optional(),
  chain_count: z.number().optional()
});

// Query schemas
export const evmTransactionsQuerySchema = paginationQuerySchema.extend({
  chain_ids: z.string().optional().describe('Comma-separated chain IDs or tags').refine((val) =>
    !val || val.split(',').every(id => id.trim().length > 0), 'Chain IDs must not be empty')
});

export const evmBalancesQuerySchema = paginationQuerySchema.extend({
  chain_ids: z.string().optional().describe('Comma-separated chain IDs or tags'),
  filters: z.enum(['erc20', 'native']).optional().describe('Filter by token type'),
  metadata: z.string().optional().describe('Additional metadata fields to include (comma-separated)').refine(
    (val) => !val || val.split(',').every(field => field.trim().length > 0),
    'Metadata fields must not be empty'
  )
});

// Type exports for TypeScript usage
export type ChainEntry = z.infer<typeof chainEntrySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type BalanceData = z.infer<typeof balanceDataSchema>;
export type TransactionsResponse = z.infer<typeof transactionsResponseSchema>;
export type BalancesResponse = z.infer<typeof balancesResponseSchema>;
````

## File: schemas/svm.ts
````typescript
// src/schemas/svm.ts

import { z } from 'zod';
import { paginationQuerySchema } from './common';

export const svmAddressSchema = z.string().min(32).max(44);

// Define proper transaction schema instead of z.any()
export const svmTransactionSchema = z.object({
  address: z.string(),
  block_slot: z.number(),
  block_time: z.number(),
  chain: z.string(),
  raw_transaction: z.record(z.unknown())
});

export const svmTransactionsResponseSchema = z.object({
  transactions: z.array(svmTransactionSchema),
  next_offset: z.string().nullable().optional()
});

// Define proper balance schema
export const svmBalanceItemSchema = z.object({
  chain: z.string(),
  address: z.string(),
  amount: z.string(),
  balance: z.string().optional(),
  value_usd: z.number().nullable().optional(),
  program_id: z.string().nullable().optional(),
  decimals: z.number().nullable().optional(),
  total_supply: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  symbol: z.string().nullable().optional(),
  uri: z.string().nullable().optional(),
  price_usd: z.number().nullable().optional(),
  liquidity_usd: z.number().nullable().optional(),
  pool_type: z.string().nullable().optional(),
  pool_address: z.string().nullable().optional(),
  mint_authority: z.string().nullable().optional()
});

export const svmBalancesResponseSchema = z.object({
  wallet_address: z.string(),
  balances: z.array(svmBalanceItemSchema),
  next_offset: z.string().nullable().optional(),
  processing_time_ms: z.number().optional(),
  balances_count: z.number().optional()
});

export const svmQuerySchema = paginationQuerySchema.extend({ chains: z.string().optional() });
````

## File: schemas/system.ts
````typescript
// src/schemas/system.ts

import { z } from 'zod';

export const healthSchema = z.object({
  status: z.literal('healthy'),
  timestamp: z.string().datetime(),
  version: z.string()
});
````

## File: types/errors.ts
````typescript
// src/types/errors.ts

import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

/**
 * Serializable error format for logging
 */
export interface SerializedError {
  message: string;
  name: string;
  stack?: string;
  code?: string;
  cause?: unknown;
  status?: number;
  zodErrors?: z.ZodIssue[];
  path?: string;
  method?: string;
  timestamp?: string;
}

/**
 * Type-safe error context for logging
 */
export interface ErrorContext {
  path?: string;
  method?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Convert any error type to a serializable format
 */
export function serializeError(error: unknown, context?: ErrorContext): SerializedError {
  const timestamp = new Date().toISOString();

  // Handle Zod errors specially
  if (error instanceof z.ZodError) {
    return {
      message: 'Validation failed',
      name: 'ZodError',
      zodErrors: error.errors,
      stack: error.stack,
      timestamp,
      ...context
    };
  }

  // Handle HTTPException
  if (error instanceof HTTPException) {
    return {
      message: error.message,
      name: 'HTTPException',
      status: error.status,
      stack: error.stack,
      cause: error.cause,
      timestamp,
      ...context
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const serialized: SerializedError = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause,
      timestamp,
      ...context
    };

    // Extract additional properties from error objects
    if ('code' in error && typeof error.code === 'string') {
      serialized.code = error.code;
    }

    return serialized;
  }

  // Handle error-like objects
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return {
      message: String(error.message),
      name: 'name' in error ? String(error.name) : 'UnknownError',
      stack: 'stack' in error ? String(error.stack) : undefined,
      status: 'status' in error && typeof error.status === 'number' ? error.status : undefined,
      timestamp,
      ...context
    };
  }

  // Fallback for non-error types
  return { message: String(error), name: 'UnknownError', timestamp, ...context };
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  context?: ErrorContext,
  isDevelopment = false
): { error: string, details?: unknown, requestId?: string } {
  const serialized = serializeError(error, context);

  return {
    error: serialized.message,
    details: isDevelopment ?
      {
        name: serialized.name,
        ...(serialized.zodErrors && { validationErrors: serialized.zodErrors }),
        ...(serialized.stack && { stack: serialized.stack }),
        ...(serialized.code && { code: serialized.code })
      } :
      undefined,
    requestId: context?.requestId
  };
}
````

## File: types/index.ts
````typescript
// src/types/index.ts

import { z } from 'zod';
import { envSchema } from '../config/env';

// Re-export error types
export * from './errors';

// Cloudflare Worker bindings with proper types
export interface Env extends z.infer<typeof envSchema> {
  RATE_LIMITER?: KVNamespace; // Optional for development, required for production
}

// Context variables with strict typing
export interface Variables {
  validatedEnv: z.infer<typeof envSchema>;
  requestId: string;
  subrequestCount: number;
}

// Rate limit data structure
export interface RateLimitData {
  count: number;
  resetTime: number;
}

// Logger types for better type safety
export interface LogContext extends Record<string, unknown> {
  path?: string;
  method?: string;
  status?: number;
  error?: unknown;
  requestId?: string;
  clientIp?: string;
  responseTime?: number;
  responseSize?: number;
}

// API Response types
export interface APIResponse<T = unknown> {
  data?: T;
  error?: string;
  details?: unknown;
  requestId?: string;
}

// Proxy configuration
export interface ProxyConfig {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

// Request metadata for tracking
export interface RequestMetadata {
  startTime: number;
  path: string;
  method: string;
  clientIp?: string;
  userAgent?: string;
}
````

## File: utils/fetch.ts
````typescript
// src/utils/fetch.ts

import { RETRY_CONFIG } from '../config/constants';
import type { Logger } from './logger';

export interface FetchRetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (response: Response) => boolean;
  onRetry?: (attempt: number, error?: Error) => void;
  logger?: Logger;
}

// Calculate delay with exponential backoff and jitter
function calculateDelay(attempt: number, initialDelay: number, maxDelay: number, backoffMultiplier: number): number {
  // Exponential backoff with jitter
  const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  const clampedDelay = Math.min(exponentialDelay, maxDelay);
  // Add jitter (±25%)
  const jitter = clampedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(clampedDelay + jitter);
}

// Default retry logic
function defaultShouldRetry(response: Response): boolean {
  // Don't retry if successful
  if (response.ok) return false;

  // Don't retry non-retryable status codes
  if (RETRY_CONFIG.NON_RETRYABLE_STATUS.has(response.status)) {
    return false;
  }

  // Retry on server errors and rate limits
  return response.status >= 500 || response.status === 429;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions: FetchRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = RETRY_CONFIG.MAX_RETRIES,
    initialDelay = RETRY_CONFIG.INITIAL_DELAY,
    maxDelay = RETRY_CONFIG.MAX_DELAY,
    backoffMultiplier = RETRY_CONFIG.BACKOFF_MULTIPLIER,
    shouldRetry = defaultShouldRetry,
    onRetry,
    logger
  } = retryOptions;

  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 1;attempt <= maxRetries;attempt++) {
    try {
      logger?.debug(`Fetching URL (attempt ${attempt}/${maxRetries})`, { url, method: options.method || 'GET' });

      const response = await fetch(url, options);
      lastResponse = response;

      // Check if we should retry
      if (attempt < maxRetries && shouldRetry(response)) {
        const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);

        logger?.info(`Retrying request after ${delay}ms`, {
          url,
          attempt,
          status: response.status,
          statusText: response.statusText
        });

        onRetry?.(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      logger?.warn(`Fetch attempt ${attempt} failed`, {
        url,
        error: error instanceof Error ? error.message : String(error),
        attempt
      });

      if (attempt < maxRetries) {
        const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);

        logger?.info(`Retrying request after network error (${delay}ms)`, {
          url,
          attempt,
          error: error instanceof Error ? error.message : String(error)
        });

        onRetry?.(attempt, error as Error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  if (lastResponse) {
    logger?.error(`All retry attempts failed with HTTP error`, {
      url,
      finalStatus: lastResponse.status,
      finalStatusText: lastResponse.statusText
    });
    return lastResponse;
  }

  logger?.error(`All retry attempts failed with network error`, { url, error: lastError?.message });

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

// Utility to create a fetch function with preset retry options
export function createRetryableFetch(defaultOptions: FetchRetryOptions) {
  return (url: string, options: RequestInit, overrideOptions?: FetchRetryOptions) => {
    return fetchWithRetry(url, options, { ...defaultOptions, ...overrideOptions });
  };
}
````

## File: utils/logger.ts
````typescript
// src/utils/logger.ts

import type { Context } from 'hono';
import type { ValidatedEnv } from '../config/env';
import type { LogContext } from '../types';
import { serializeError } from '../types/errors';

// Pino-like log levels
const LOG_LEVELS = { debug: 20, info: 30, warn: 40, error: 50 } as const;

type LogLevel = keyof typeof LOG_LEVELS;

// Logger interface with strict typing
export interface Logger {
  debug(msg: string, context?: LogContext): void;
  info(msg: string, context?: LogContext): void;
  warn(msg: string, context?: LogContext): void;
  error(msg: string, context?: LogContext): void;
}

// Log object structure
interface LogObject {
  level: number;
  time: number;
  pid: number;
  hostname: string;
  reqId: string;
  msg: string;
  [key: string]: unknown;
}

// Sensitive field patterns for sanitization
const SENSITIVE_PATTERNS = [
  'authorization',
  'x-sim-api-key',
  'x-api-key',
  'api_key',
  'apikey',
  'password',
  'token',
  'secret',
  'private',
  'credential'
] as const;

// Sanitize sensitive data from logs
function sanitizeLogData(data: unknown, isDevelopment = false): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data !== 'object') return data;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item, isDevelopment));
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains sensitive patterns
    if (SENSITIVE_PATTERNS.some(pattern => lowerKey.includes(pattern))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Handle special cases
    if (key === 'error' && value) {
      // Serialize error objects properly
      sanitized[key] = serializeError(value);

      // Remove stack traces in production
      if (!isDevelopment && sanitized[key] && typeof sanitized[key] === 'object') {
        const errorObj = sanitized[key] as Record<string, unknown>;
        delete errorObj['stack'];
      }
    } else if (key === 'url' && typeof value === 'string') {
      // Sanitize URLs
      sanitized[key] = sanitizeUrl(value);
    } else if (typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeLogData(value, isDevelopment);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Sanitize URLs to remove sensitive query parameters
function sanitizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    const params = new URLSearchParams(url.search);

    for (const [key] of params) {
      if (SENSITIVE_PATTERNS.some(pattern => key.toLowerCase().includes(pattern))) {
        params.set(key, '[REDACTED]');
      }
    }

    url.search = params.toString();
    return url.toString();
  } catch {
    // Invalid URL, return as is
    return urlString;
  }
}

// Create a logger instance for a context
export function createLogger(c: Context): Logger {
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv | undefined;
  const isDevelopment = validatedEnv?.NODE_ENV === 'development';
  const requestId = c.get('requestId') || crypto.randomUUID();

  const log = (level: LogLevel, msg: string, context?: LogContext): void => {
    // Skip debug logs in production
    if (level === 'debug' && !isDevelopment) return;

    // Build log object
    const logObj: LogObject = {
      level: LOG_LEVELS[level],
      time: Date.now(),
      pid: 1, // Cloudflare Workers don't have process IDs
      hostname: 'cloudflare-worker',
      reqId: requestId,
      msg
    };

    // Add sanitized context
    if (context) {
      const sanitized = sanitizeLogData(context, isDevelopment);
      if (typeof sanitized === 'object' && sanitized !== null) {
        Object.assign(logObj, sanitized);
      }
    }

    // Output format based on environment
    if (isDevelopment) {
      // Pretty print in development
      const levelStr = level.toUpperCase().padEnd(5);
      const timeStr = new Date(logObj.time).toISOString();
      console.log(`[${timeStr}] ${levelStr} (${requestId}): ${msg}`);

      if (context && Object.keys(context).length > 0) {
        console.log(JSON.stringify(sanitizeLogData(context, true), null, 2));
      }
    } else {
      // Single-line JSON in production
      console.log(JSON.stringify(logObj));
    }
  };

  return {
    debug: (msg, context) => log('debug', msg, context),
    info: (msg, context) => log('info', msg, context),
    warn: (msg, context) => log('warn', msg, context),
    error: (msg, context) => log('error', msg, context)
  };
}

// Create a child logger with additional context
export function createChildLogger(parentLogger: Logger, additionalContext: LogContext): Logger {
  return {
    debug: (msg, context) => parentLogger.debug(msg, { ...additionalContext, ...context }),
    info: (msg, context) => parentLogger.info(msg, { ...additionalContext, ...context }),
    warn: (msg, context) => parentLogger.warn(msg, { ...additionalContext, ...context }),
    error: (msg, context) => parentLogger.error(msg, { ...additionalContext, ...context })
  };
}
````

## File: utils/proxy.ts
````typescript
// src/utils/proxy.ts

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { CACHE_CONFIG, DEDUP_CONFIG, DUNE_SIM_BASE_ENDPOINT, HEADERS, MAX_RESPONSE_SIZE, MAX_SUBREQUESTS } from '../config/constants';
import type { ValidatedEnv } from '../config/env';
import type { Variables } from '../types';
import { serializeError } from '../types/errors';
import { fetchWithRetry } from './fetch';
import { createChildLogger, createLogger, type Logger } from './logger';

// In-flight request deduplication
const inFlightRequests = new Map<string, Promise<Response>>();

// Helper to create cache headers
function createCacheHeaders(path: string): HeadersInit {
  const headers = new Headers();

  if (path.includes('supported-chains')) {
    headers.set(
      'Cache-Control',
      `public, max-age=${CACHE_CONFIG.SUPPORTED_CHAINS_TTL}, s-maxage=${CACHE_CONFIG.SUPPORTED_CHAINS_STALE_TTL}`
    );
  } else {
    headers.set('Cache-Control', 'private, no-cache');
  }

  headers.set('Content-Type', 'application/json');
  return headers;
}

// Helper to check if we should deduplicate a request
function shouldDeduplicate(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

export async function proxyRequest<T extends z.ZodSchema>(
  c: Context<{ Variables: Variables }>,
  path: string,
  responseSchema: T,
  queryParams?: URLSearchParams
): Promise<Response> {
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv;
  const logger = createLogger(c);
  const requestLogger = createChildLogger(logger, { proxyPath: path });

  // Build full URL
  const url = new URL(`${DUNE_SIM_BASE_ENDPOINT}${path}`);
  if (queryParams) {
    url.search = queryParams.toString();
  }

  // Check subrequest limit
  const requestCount = c.get('subrequestCount') || 0;
  if (requestCount >= MAX_SUBREQUESTS) {
    requestLogger.error('Subrequest limit exceeded', { limit: MAX_SUBREQUESTS, current: requestCount });
    throw new HTTPException(429, {
      message: 'Too many subrequests in this request',
      cause: { limit: MAX_SUBREQUESTS, current: requestCount }
    });
  }
  c.set('subrequestCount', requestCount + 1);

  // Create request key for deduplication
  const requestKey = `${c.req.method}:${url.toString()}`;
  const canDeduplicate = shouldDeduplicate(c.req.method);

  // Check for in-flight request if deduplication is enabled
  if (canDeduplicate) {
    const inFlight = inFlightRequests.get(requestKey);
    if (inFlight) {
      requestLogger.debug('Reusing in-flight request');
      try {
        const response = await inFlight;
        return response.clone();
      } catch (error) {
        requestLogger.debug('In-flight request failed, making new request', { error: serializeError(error) });
      }
    }
  }

  // Prepare request headers
  const headers = new Headers({
    [HEADERS.API_KEY]: validatedEnv.DUNE_SIM_API_KEY,
    'Content-Type': 'application/json',
    [HEADERS.REQUEST_ID]: c.get('requestId'),
    'User-Agent': `Dune-Sim-Proxy/1.0 (+https://github.com/cipher-rc5)`
  });

  // Create the request promise
  const requestPromise = executeProxyRequest(c, url, headers, responseSchema, requestLogger);

  // Store in-flight request if deduplication is enabled
  if (canDeduplicate) {
    inFlightRequests.set(requestKey, requestPromise);

    // Clean up after delay
    setTimeout(() => {
      inFlightRequests.delete(requestKey);
    }, DEDUP_CONFIG.CLEANUP_DELAY);
  }

  return requestPromise;
}

async function executeProxyRequest<T extends z.ZodSchema>(
  c: Context<{ Variables: Variables }>,
  url: URL,
  headers: Headers,
  responseSchema: T,
  logger: Logger
): Promise<Response> {
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv;
  const startTime = Date.now();

  try {
    // Prepare request body for non-GET requests
    let body: string | undefined;
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      body = await c.req.text();
    }

    logger.info('Proxying request', { method: c.req.method, hasBody: !!body, bodySize: body?.length });

    // Make the request with retry
    const response = await fetchWithRetry(url.toString(), { method: c.req.method, headers, body }, {
      logger,
      shouldRetry: (res) => {
        // Custom retry logic for proxy
        if (res.ok) return false;

        // Always retry rate limits with backoff
        if (res.status === 429) return true;

        // Retry server errors except specific ones
        if (res.status >= 500) {
          return res.status !== 501 && res.status !== 505;
        }

        return false;
      }
    });

    // Process response
    const { data, bodyText, totalSize } = await processResponse(response, logger);

    if (response.ok) {
      try {
        const validatedData = responseSchema.parse(data);

        const responseTime = Date.now() - startTime;
        logger.info('Proxy request successful', { status: response.status, responseSize: totalSize, responseTime });

        return new Response(JSON.stringify(validatedData), {
          status: response.status,
          headers: createCacheHeaders(url.pathname)
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.error('Invalid upstream response schema', {
            error: serializeError(error),
            status: response.status,
            responsePreview: bodyText.substring(0, 500)
          });

          throw new HTTPException(502, {
            message: 'Invalid response schema from upstream API',
            cause: validatedEnv.NODE_ENV === 'development' ? error.errors : undefined
          });
        }
        throw error;
      }
    } else {
      // Log upstream error
      logger.warn('Upstream API error', {
        status: response.status,
        statusText: response.statusText,
        responseTime: Date.now() - startTime,
        errorData: data
      });

      // Return upstream error response
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    logger.error('Proxy request failed', { error: serializeError(error), responseTime: Date.now() - startTime });

    throw new HTTPException(500, {
      message: 'Failed to proxy request',
      cause: validatedEnv.NODE_ENV === 'development' ? error : undefined
    });
  }
}

async function processResponse(
  response: Response,
  logger: Logger
): Promise<{ data: unknown, bodyText: string, totalSize: number }> {
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  if (!response.body) {
    return { data: null, bodyText: '', totalSize: 0 };
  }

  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;

      if (totalSize > MAX_RESPONSE_SIZE) {
        reader.cancel();
        logger.error('Response size exceeded limit', { totalSize, limit: MAX_RESPONSE_SIZE });

        throw new HTTPException(413, {
          message: `Response too large: ${totalSize} bytes exceeds ${MAX_RESPONSE_SIZE} bytes limit`
        });
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  // Combine chunks
  const bodyArray = new Uint8Array(totalSize);
  let position = 0;
  for (const chunk of chunks) {
    bodyArray.set(chunk, position);
    position += chunk.length;
  }

  const bodyText = new TextDecoder().decode(bodyArray);

  // Parse JSON
  try {
    const data = JSON.parse(bodyText);
    return { data, bodyText, totalSize };
  } catch (error) {
    logger.error('Failed to parse upstream response as JSON', {
      error: serializeError(error),
      responseStatus: response.status,
      bodyPreview: bodyText.substring(0, 200)
    });

    throw new HTTPException(502, { message: 'Invalid JSON response from upstream API' });
  }
}
````

## File: index.ts
````typescript
// src/index.ts

import { Scalar } from '@scalar/hono-api-reference';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import { CACHE_CONFIG, HEADERS, RATE_LIMIT_DEFAULTS } from './config/constants';
import { parseAllowedOrigins, type ValidatedEnv } from './config/env';
import { openAPISpec } from './config/openapi';
import { authMiddleware } from './middleware/auth';
import { envMiddleware } from './middleware/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { createRateLimiter } from './middleware/rateLimit';
import { requestIdMiddleware } from './middleware/requestId';
import { evmRoutes } from './routes/evm';
import { svmRoutes } from './routes/svm';
import { systemRoutes } from './routes/system';
import type { Env, Variables } from './types';
import { createLogger } from './utils/logger';

// Initialize Hono app with proper types
const app = new Hono<{ Bindings: Env, Variables: Variables }>();

// Environment validation middleware - must be first
app.use('*', envMiddleware);

// Request ID middleware - early in chain
app.use('*', requestIdMiddleware);

// Timing middleware for performance monitoring
app.use('*', timing());

// Logging middleware
app.use('*', logger());

// Security headers
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"]
    },
    crossOriginEmbedderPolicy: false, // Disabled for API
    crossOriginOpenerPolicy: false, // Disabled for API
    crossOriginResourcePolicy: false, // Disabled for API
    originAgentCluster: '?1',
    referrerPolicy: 'no-referrer',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    xContentTypeOptions: 'nosniff',
    xDnsPrefetchControl: 'off',
    xDownloadOptions: 'noopen',
    xFrameOptions: 'DENY',
    xPermittedCrossDomainPolicies: 'none',
    xXssProtection: '0' // Disabled in modern browsers
  })
);

// CORS middleware with dynamic configuration
app.use('*', async (c, next) => {
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv;
  const allowedOrigins = parseAllowedOrigins(validatedEnv.ALLOWED_ORIGINS);

  return cors({
    origin: (origin) => {
      // In development, allow all origins
      if (validatedEnv.NODE_ENV === 'development') return '*';

      // Check if origin is allowed
      if (allowedOrigins.includes('*')) return '*';
      if (origin && allowedOrigins.includes(origin)) return origin;

      // Default to null (disallow)
      return null;
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: [HEADERS.CONTENT_TYPE, HEADERS.AUTHORIZATION, HEADERS.REQUEST_ID],
    exposeHeaders: [
      'Content-Length',
      HEADERS.REQUEST_ID,
      HEADERS.RATE_LIMIT_LIMIT,
      HEADERS.RATE_LIMIT_REMAINING,
      HEADERS.RATE_LIMIT_RESET,
      HEADERS.RESPONSE_TIME
    ],
    maxAge: 600,
    credentials: false
  })(c, next);
});

// Rate limiting with different limits for different routes
app.use('/v1/*', createRateLimiter.api());
app.use('/beta/*', createRateLimiter.beta());
app.use('/docs', createRateLimiter.docs());
app.use('/scalar', createRateLimiter.docs());

// Authentication middleware
app.use('*', authMiddleware);

// OpenAPI documentation endpoint
app.get('/openapi.json', (c) => {
  c.header(HEADERS.CACHE_CONTROL, `public, max-age=${CACHE_CONFIG.DOCUMENTATION_TTL}`);
  return c.json(openAPISpec);
});

// Scalar API Reference
app.get(
  '/docs',
  Scalar({
    url: '/openapi.json',
    layout: 'modern',
    theme: 'purple',
    hideModels: false,
    showSidebar: true,
    searchHotKey: 'k',
    customCss: `
      .scalar-api-reference {
        --scalar-color-1: #6b21a8;
        --scalar-color-2: #a855f7;
        --scalar-color-accent: #9333ea;
        --scalar-background-1: #ffffff;
        --scalar-background-2: #fafafa;
        --scalar-background-3: #f3f4f6;
        --scalar-border-color: #e5e7eb;
      }

      @media (prefers-color-scheme: dark) {
        .scalar-api-reference {
          --scalar-background-1: #111111;
          --scalar-background-2: #1a1a1a;
          --scalar-background-3: #252525;
          --scalar-border-color: #333333;
        }
      }
    `
  })
);

// Alternative Scalar endpoint
app.get('/scalar', (c) => c.redirect('/docs', 301));

// Enhanced markdown documentation generator
function generateMarkdownFromSpec(spec: typeof openAPISpec): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${spec.info.title}`);
  lines.push(`Version: ${spec.info.version}\n`);
  lines.push(`${spec.info.description}\n`);

  // Contact & License
  if (spec.info.contact) {
    lines.push(`**Contact**: ${spec.info.contact.name} (${spec.info.contact.email})\n`);
  }
  if (spec.info.license) {
    lines.push(`**License**: [${spec.info.license.name}](${spec.info.license.url})\n`);
  }

  // Servers
  lines.push(`## Servers\n`);
  spec.servers.forEach(server => {
    lines.push(`- ${server.description}: \`${server.url}\``);
  });
  lines.push('');

  // Authentication
  lines.push(`## Authentication\n`);
  lines.push(`All API endpoints (except documentation and health) require Bearer token authentication:\n`);
  lines.push('```bash');
  lines.push('curl -H "Authorization: Bearer your_api_key" \\');
  lines.push('     https://your-worker.workers.dev/v1/evm/balances/0x...');
  lines.push('```\n');

  // Rate Limits
  lines.push(`## Rate Limits\n`);
  lines.push(
    `- **API endpoints** (/v1/*): ${RATE_LIMIT_DEFAULTS.API_REQUESTS} requests per ${RATE_LIMIT_DEFAULTS.API_WINDOW}`
  );
  lines.push(
    `- **Beta endpoints** (/beta/*): ${RATE_LIMIT_DEFAULTS.BETA_REQUESTS} requests per ${RATE_LIMIT_DEFAULTS.BETA_WINDOW}`
  );
  lines.push(
    `- **Documentation** (/docs, /scalar): ${RATE_LIMIT_DEFAULTS.DOCS_REQUESTS} requests per ${RATE_LIMIT_DEFAULTS.DOCS_WINDOW}\n`
  );

  // Headers
  lines.push(`## Response Headers\n`);
  lines.push(`- \`${HEADERS.REQUEST_ID}\`: Unique request identifier for tracking`);
  lines.push(`- \`${HEADERS.RATE_LIMIT_LIMIT}\`: Rate limit ceiling`);
  lines.push(`- \`${HEADERS.RATE_LIMIT_REMAINING}\`: Requests remaining in window`);
  lines.push(`- \`${HEADERS.RATE_LIMIT_RESET}\`: Unix timestamp when limit resets`);
  lines.push(`- \`${HEADERS.RESPONSE_TIME}\`: Response time in milliseconds\n`);

  // Endpoints by tag
  lines.push(`## Endpoints\n`);

  const endpointsByTag = new Map<string, Array<{ path: string, method: string, details: any }>>();

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, details] of Object.entries(methods as Record<string, any>)) {
      const tags = details.tags || ['Other'];
      for (const tag of tags) {
        if (!endpointsByTag.has(tag)) {
          endpointsByTag.set(tag, []);
        }
        endpointsByTag.get(tag)!.push({ path, method, details });
      }
    }
  }

  // Write endpoints grouped by tag
  for (const [tag, endpoints] of endpointsByTag) {
    lines.push(`### ${tag}\n`);

    for (const { path, method, details } of endpoints) {
      lines.push(`#### \`${method.toUpperCase()} ${path}\``);

      if (details.summary) {
        lines.push(`**${details.summary}**\n`);
      }

      if (details.description) {
        lines.push(`${details.description}\n`);
      }

      // Parameters
      if (details.parameters?.length > 0) {
        lines.push('**Parameters:**\n');
        lines.push('| Name | Type | In | Required | Description |');
        lines.push('|------|------|----|----------|-------------|');
        for (const param of details.parameters) {
          const required = param.required ? '✓' : '';
          const schema = param.schema?.type || 'string';
          lines.push(`| ${param.name} | ${schema} | ${param.in} | ${required} | ${param.description || '-'} |`);
        }
        lines.push('');
      }

      // Example request
      if (details.operationId) {
        lines.push('**Example Request:**');
        lines.push('```bash');
        const examplePath = path.replace('{address}', '0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
        lines.push(`curl -X ${method.toUpperCase()} \\`);
        lines.push(`  "https://your-worker.workers.dev${examplePath}" \\`);
        lines.push(`  -H "Authorization: Bearer your_api_key"`);
        lines.push('```\n');
      }

      lines.push('---\n');
    }
  }

  // Error handling
  lines.push(`## Error Responses\n`);
  lines.push(`All errors follow a consistent format:\n`);
  lines.push('```json');
  lines.push('{');
  lines.push('  "error": "Error message",');
  lines.push('  "details": "Additional context (development only)",');
  lines.push('  "requestId": "unique-request-id",');
  lines.push('  "timestamp": "2024-01-01T00:00:00.000Z"');
  lines.push('}');
  lines.push('```\n');

  lines.push(`### Common Error Codes\n`);
  lines.push('- `400` - Bad Request (validation error)');
  lines.push('- `401` - Unauthorized (missing/invalid API key)');
  lines.push('- `404` - Not Found');
  lines.push('- `429` - Too Many Requests (rate limit exceeded)');
  lines.push('- `500` - Internal Server Error');
  lines.push('- `502` - Bad Gateway (upstream API error)');

  return lines.join('\n');
}

// LLM-friendly markdown documentation
app.get('/llms.txt', async (c) => {
  const logger = createLogger(c);

  try {
    const markdown = generateMarkdownFromSpec(openAPISpec);

    return c.text(markdown, 200, {
      [HEADERS.CONTENT_TYPE]: 'text/plain; charset=utf-8',
      [HEADERS.CACHE_CONTROL]: `public, max-age=${CACHE_CONFIG.DOCUMENTATION_TTL}`
    });
  } catch (error) {
    logger.error('Failed to generate documentation', { error });
    return c.text('Failed to generate documentation', 500);
  }
});

// Mount routes
app.route('/', systemRoutes);
app.route('/v1/evm', evmRoutes);
app.route('/beta/svm', svmRoutes);

// Error handling
app.onError((err, c) => errorHandler(err, c as any));

// 404 handler
app.notFound((c) => notFoundHandler(c as any));

// Export for Cloudflare Workers
export default app;
````
