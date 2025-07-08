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
