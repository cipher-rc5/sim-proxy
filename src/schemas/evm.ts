// src/schemas/evm.ts

import { z } from 'zod';
import { paginationQuerySchema, warningSchema } from './common';

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
  details: z.record(z.string(), z.unknown()).optional()
}).passthrough(); // Allow additional error fields

// Transactions response
export const transactionsResponseSchema = z.object({
  wallet_address: z.string(),
  transactions: z.array(transactionSchema),
  errors: z.union([duneErrorSchema, z.array(duneErrorSchema), z.null()]).optional(),
  warnings: z.array(warningSchema).optional(),
  next_offset: z.string().nullable().optional(),
  request_time: z.string().datetime().nullable().optional(),
  response_time: z.string().datetime().nullable().optional()
}).passthrough();

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
    social: z.record(z.string(), z.string().url()).optional()
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
  warnings: z.array(warningSchema).optional(),
  next_offset: z.string().optional(), // Not nullable according to API
  request_time: z.string().datetime().nullable().optional(),
  response_time: z.string().datetime().nullable().optional(),
  // Additional response metadata
  total_usd_value: z.number().nullable().optional(),
  chain_count: z.number().optional()
}).passthrough();

export const activityTypeSchema = z.enum(['send', 'receive', 'mint', 'burn', 'swap', 'approve', 'call']);
export const assetTypeSchema = z.enum(['native', 'erc20', 'erc721', 'erc1155']);

export const activityItemSchema = z.object({
  chain_id: z.number().optional(),
  block_number: z.number().optional(),
  block_time: z.string(),
  tx_hash: z.string().optional(),
  transaction_hash: z.string().optional(),
  type: activityTypeSchema,
  asset_type: assetTypeSchema.optional(),
  token_address: z.string().nullable().optional(),
  token_id: z.string().nullable().optional(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  value: z.string().optional(),
  value_usd: z.number().nullable().optional(),
  function: z.object({
    name: z.string().optional(),
    signature: z.string().optional()
  }).partial().optional(),
  token_metadata: z.object({
    symbol: z.string().nullable().optional(),
    decimals: z.number().nullable().optional(),
    price_usd: z.number().nullable().optional(),
    logo: z.string().url().nullable().optional()
  }).passthrough().nullable().optional()
}).passthrough();

export const activityResponseSchema = z.object({
  activity: z.array(activityItemSchema),
  warnings: z.array(warningSchema).optional(),
  next_offset: z.string().nullable().optional(),
  request_time: z.string().datetime().nullable().optional(),
  response_time: z.string().datetime().nullable().optional()
}).passthrough();

export const collectibleEntrySchema = z.object({
  contract_address: z.string(),
  token_standard: z.enum(['ERC721', 'ERC1155']).optional(),
  token_id: z.string(),
  chain: z.string().optional(),
  chain_id: z.number().optional(),
  balance: z.string().optional(),
  is_spam: z.boolean().optional()
}).passthrough();

export const collectiblesResponseSchema = z.object({
  address: z.string(),
  entries: z.array(collectibleEntrySchema),
  warnings: z.array(warningSchema).optional(),
  next_offset: z.string().optional(),
  request_time: z.string().datetime().optional(),
  response_time: z.string().datetime().optional()
}).passthrough();

export const tokenInfoItemSchema = z.object({
  chain: z.string().optional(),
  chain_id: z.number().optional(),
  symbol: z.string().optional(),
  name: z.string().optional(),
  decimals: z.number().optional(),
  price_usd: z.number().nullable().optional(),
  logo: z.string().nullable().optional()
}).passthrough();

export const tokenInfoResponseSchema = z.object({
  contract_address: z.string(),
  tokens: z.array(tokenInfoItemSchema),
  warnings: z.array(warningSchema).optional(),
  next_offset: z.string().optional()
}).passthrough();

export const tokenHolderSchema = z.object({
  wallet_address: z.string(),
  balance: z.string(),
  first_acquired: z.string().optional(),
  has_initiated_transfer: z.boolean().optional()
}).passthrough();

export const tokenHoldersResponseSchema = z.object({
  token_address: z.string(),
  chain_id: z.number(),
  holders: z.array(tokenHolderSchema),
  next_offset: z.string().optional()
}).passthrough();

export const defiPositionsResponseSchema = z.object({
  positions: z.array(z.object({
    type: z.string(),
    chain_id: z.number().optional(),
    usd_value: z.number().nullable().optional()
  }).passthrough()),
  aggregations: z.object({
    total_usd_value: z.number().optional(),
    total_by_chain: z.record(z.string(), z.number()).optional()
  }).passthrough().optional(),
  warnings: z.array(warningSchema).optional()
}).passthrough();

export const stablecoinsResponseSchema = z.object({
  wallet_address: z.string(),
  balances: z.array(balanceDataSchema),
  errors: z.union([duneErrorSchema, z.array(duneErrorSchema), z.null()]).optional(),
  warnings: z.array(warningSchema).optional(),
  next_offset: z.string().optional(),
  request_time: z.string().datetime().nullable().optional(),
  response_time: z.string().datetime().nullable().optional()
}).passthrough();

// Query schemas
export const evmTransactionsQuerySchema = paginationQuerySchema.extend({
  chain_ids: z.string().optional().describe('Comma-separated chain IDs or tags').refine((val) =>
    !val || val.split(',').every(id => id.trim().length > 0), 'Chain IDs must not be empty')
});

export const evmBalancesQuerySchema = paginationQuerySchema.extend({
  chain_ids: z.string().optional().describe('Comma-separated chain IDs or tags'),
  filters: z.enum(['erc20', 'native']).optional().describe('Filter by token type'),
  exclude_spam_tokens: z.coerce.boolean().optional().describe('Exclude low-liquidity spam tokens'),
  historical_prices: z.string().optional().describe('Comma-separated hour offsets for historical prices (max 3 values)'),
  metadata: z.string().optional().describe('Additional metadata fields to include (comma-separated)').refine(
    (val) => !val || val.split(',').every(field => field.trim().length > 0),
    'Metadata fields must not be empty'
  )
});

export const evmActivityQuerySchema = paginationQuerySchema.extend({
  chain_ids: z.string().optional().describe('Comma-separated chain IDs or tags'),
  token_address: z.string().optional().describe('Single or comma-separated token addresses'),
  activity_type: z.string().optional().describe('Single or comma-separated values of send,receive,mint,burn,swap,approve,call'),
  asset_type: z.string().optional().describe('Single or comma-separated values of native,erc20,erc721,erc1155')
});

export const evmCollectiblesQuerySchema = paginationQuerySchema.extend({
  chain_ids: z.string().optional().describe('Comma-separated chain IDs or tags'),
  filter_spam: z.coerce.boolean().optional().describe('Hide spam collectibles when true'),
  show_spam_scores: z.coerce.boolean().optional().describe('Include spam scoring metadata')
});

export const evmStablecoinsQuerySchema = paginationQuerySchema.extend({
  chain_ids: z.string().optional().describe('Comma-separated chain IDs or tags'),
  filters: z.enum(['erc20', 'native']).optional().describe('Filter by token type'),
  metadata: z.string().optional().describe('Additional metadata fields to include (comma-separated)'),
  exclude_spam_tokens: z.coerce.boolean().optional().describe('Exclude low-liquidity spam tokens'),
  historical_prices: z.string().optional().describe('Comma-separated hour offsets for historical prices (max 3 values)')
});

export const evmTokenInfoQuerySchema = paginationQuerySchema.extend({
  chain_ids: z.string().min(1).describe('Exactly one chain ID is required by upstream'),
  historical_prices: z.string().optional().describe('Comma-separated hour offsets for historical prices (max 3 values)')
});

export const evmTokenHoldersQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(500).optional(),
  offset: z.string().optional()
});

export const evmDefiPositionsQuerySchema = z.object({
  chain_ids: z.string().optional().describe('Comma-separated chain IDs or tags')
});

// Type exports for TypeScript usage
export type ChainEntry = z.infer<typeof chainEntrySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type BalanceData = z.infer<typeof balanceDataSchema>;
export type TransactionsResponse = z.infer<typeof transactionsResponseSchema>;
export type BalancesResponse = z.infer<typeof balancesResponseSchema>;
export type ActivityResponse = z.infer<typeof activityResponseSchema>;
export type CollectiblesResponse = z.infer<typeof collectiblesResponseSchema>;
export type TokenInfoResponse = z.infer<typeof tokenInfoResponseSchema>;
export type TokenHoldersResponse = z.infer<typeof tokenHoldersResponseSchema>;
export type DefiPositionsResponse = z.infer<typeof defiPositionsResponseSchema>;
export type StablecoinsResponse = z.infer<typeof stablecoinsResponseSchema>;
