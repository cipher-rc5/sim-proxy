// src/schemas/evm.ts

import { Schema } from 'effect';
import { paginationQuerySchema, warningSchema } from './common';

// Boolean coercion helper for query string params ("true"/"false" → boolean)
const BooleanFromString = Schema.transform(
  Schema.String,
  Schema.Boolean,
  { strict: true, decode: (s) => s === 'true', encode: (b) => String(b) }
);

// EVM address validation
export const evmAddressSchema = Schema.String.pipe(
  Schema.pattern(/^0x[a-fA-F0-9]{40}$/, { message: () => 'Invalid EVM address format' })
);

// Chain entry schema
export const chainEntrySchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  supported_assets: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.Array(Schema.String),
  rpc_url: Schema.optional(Schema.NullOr(Schema.String)),
  explorer_url: Schema.optional(Schema.NullOr(Schema.String)),
  logo: Schema.optional(Schema.NullOr(Schema.String))
});

export const chainsResponseSchema = Schema.Struct({
  chains: Schema.Array(chainEntrySchema)
});

// Dune API error structure
export const duneErrorSchema = Schema.Struct({
  error: Schema.String,
  message: Schema.optional(Schema.String),
  code: Schema.optional(Schema.String),
  details: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
});

// Transaction schema - aligned with Dune Sim API
export const transactionSchema = Schema.Struct({
  address: Schema.String,
  block_hash: Schema.String,
  block_number: Schema.String,
  block_time: Schema.String,
  block_version: Schema.optional(Schema.Number),
  chain: Schema.String,
  from: Schema.String,
  to: Schema.optional(Schema.NullOr(Schema.String)),
  data: Schema.optional(Schema.String),
  gas: Schema.optional(Schema.String),
  gas_price: Schema.optional(Schema.NullOr(Schema.String)),
  gas_used: Schema.optional(Schema.String),
  hash: Schema.String,
  index: Schema.optional(Schema.String),
  max_fee_per_gas: Schema.optional(Schema.NullOr(Schema.String)),
  max_priority_fee_per_gas: Schema.optional(Schema.NullOr(Schema.String)),
  nonce: Schema.optional(Schema.String),
  transaction_type: Schema.optional(Schema.String),
  value: Schema.optional(Schema.String),
  access_list: Schema.optional(Schema.Array(Schema.Unknown)),
  y_parity: Schema.optional(Schema.String),
  v: Schema.optional(Schema.String),
  r: Schema.optional(Schema.String),
  s: Schema.optional(Schema.String)
});

// Transactions response
export const transactionsResponseSchema = Schema.Struct({
  wallet_address: Schema.String,
  transactions: Schema.Array(transactionSchema),
  errors: Schema.optional(Schema.NullOr(Schema.Union(duneErrorSchema, Schema.Array(duneErrorSchema)))),
  warnings: Schema.optional(Schema.Array(warningSchema)),
  next_offset: Schema.optional(Schema.NullOr(Schema.String)),
  request_time: Schema.optional(Schema.NullOr(Schema.String)),
  response_time: Schema.optional(Schema.NullOr(Schema.String))
});

// Balance data schema
export const balanceDataSchema = Schema.Struct({
  address: Schema.String,
  amount: Schema.String,
  chain: Schema.String,
  chain_id: Schema.optional(Schema.Number),
  decimals: Schema.optional(Schema.NullOr(Schema.Number)),
  low_liquidity: Schema.optional(Schema.Boolean),
  name: Schema.optional(Schema.NullOr(Schema.String)),
  pool_size: Schema.optional(Schema.NullOr(Schema.Number)),
  price_usd: Schema.optional(Schema.NullOr(Schema.Number)),
  symbol: Schema.optional(Schema.NullOr(Schema.String)),
  token_metadata: Schema.optional(Schema.NullOr(Schema.Struct({
    logo: Schema.optional(Schema.NullOr(Schema.String)),
    url: Schema.optional(Schema.NullOr(Schema.String)),
    description: Schema.optional(Schema.NullOr(Schema.String)),
    social: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String }))
  }))),
  value_usd: Schema.optional(Schema.NullOr(Schema.Number)),
  last_transfer_timestamp: Schema.optional(Schema.NullOr(Schema.String)),
  spam_score: Schema.optional(Schema.NullOr(Schema.Number.pipe(Schema.between(0, 1))))
});

// Balances response
export const balancesResponseSchema = Schema.Struct({
  wallet_address: Schema.String,
  balances: Schema.Array(balanceDataSchema),
  errors: Schema.optional(Schema.NullOr(Schema.Union(duneErrorSchema, Schema.Array(duneErrorSchema)))),
  warnings: Schema.optional(Schema.Array(warningSchema)),
  next_offset: Schema.optional(Schema.String),
  request_time: Schema.optional(Schema.NullOr(Schema.String)),
  response_time: Schema.optional(Schema.NullOr(Schema.String)),
  total_usd_value: Schema.optional(Schema.NullOr(Schema.Number)),
  chain_count: Schema.optional(Schema.Number)
});

export const activityTypeSchema = Schema.Literal('send', 'receive', 'mint', 'burn', 'swap', 'approve', 'call');
export const assetTypeSchema = Schema.Literal('native', 'erc20', 'erc721', 'erc1155');

export const activityItemSchema = Schema.Struct({
  chain_id: Schema.optional(Schema.Number),
  block_number: Schema.optional(Schema.Number),
  block_time: Schema.String,
  tx_hash: Schema.optional(Schema.String),
  transaction_hash: Schema.optional(Schema.String),
  type: activityTypeSchema,
  asset_type: Schema.optional(assetTypeSchema),
  token_address: Schema.optional(Schema.NullOr(Schema.String)),
  token_id: Schema.optional(Schema.NullOr(Schema.String)),
  from: Schema.optional(Schema.NullOr(Schema.String)),
  to: Schema.optional(Schema.NullOr(Schema.String)),
  value: Schema.optional(Schema.String),
  value_usd: Schema.optional(Schema.NullOr(Schema.Number)),
  function: Schema.optional(Schema.Struct({
    name: Schema.optional(Schema.String),
    signature: Schema.optional(Schema.String)
  })),
  token_metadata: Schema.optional(Schema.NullOr(Schema.Struct({
    symbol: Schema.optional(Schema.NullOr(Schema.String)),
    decimals: Schema.optional(Schema.NullOr(Schema.Number)),
    price_usd: Schema.optional(Schema.NullOr(Schema.Number)),
    logo: Schema.optional(Schema.NullOr(Schema.String))
  })))
});

export const activityResponseSchema = Schema.Struct({
  activity: Schema.Array(activityItemSchema),
  warnings: Schema.optional(Schema.Array(warningSchema)),
  next_offset: Schema.optional(Schema.NullOr(Schema.String)),
  request_time: Schema.optional(Schema.NullOr(Schema.String)),
  response_time: Schema.optional(Schema.NullOr(Schema.String))
});

export const collectibleEntrySchema = Schema.Struct({
  contract_address: Schema.String,
  token_standard: Schema.optional(Schema.Literal('ERC721', 'ERC1155')),
  token_id: Schema.String,
  chain: Schema.optional(Schema.String),
  chain_id: Schema.optional(Schema.Number),
  balance: Schema.optional(Schema.String),
  is_spam: Schema.optional(Schema.Boolean)
});

export const collectiblesResponseSchema = Schema.Struct({
  address: Schema.String,
  entries: Schema.Array(collectibleEntrySchema),
  warnings: Schema.optional(Schema.Array(warningSchema)),
  next_offset: Schema.optional(Schema.String),
  request_time: Schema.optional(Schema.String),
  response_time: Schema.optional(Schema.String)
});

export const tokenInfoItemSchema = Schema.Struct({
  chain: Schema.optional(Schema.String),
  chain_id: Schema.optional(Schema.Number),
  symbol: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  decimals: Schema.optional(Schema.Number),
  price_usd: Schema.optional(Schema.NullOr(Schema.Number)),
  logo: Schema.optional(Schema.NullOr(Schema.String))
});

export const tokenInfoResponseSchema = Schema.Struct({
  contract_address: Schema.String,
  tokens: Schema.Array(tokenInfoItemSchema),
  warnings: Schema.optional(Schema.Array(warningSchema)),
  next_offset: Schema.optional(Schema.String)
});

export const tokenHolderSchema = Schema.Struct({
  wallet_address: Schema.String,
  balance: Schema.String,
  first_acquired: Schema.optional(Schema.String),
  has_initiated_transfer: Schema.optional(Schema.Boolean)
});

export const tokenHoldersResponseSchema = Schema.Struct({
  token_address: Schema.String,
  chain_id: Schema.Number,
  holders: Schema.Array(tokenHolderSchema),
  next_offset: Schema.optional(Schema.String)
});

export const defiPositionsResponseSchema = Schema.Struct({
  positions: Schema.Array(Schema.Struct({
    type: Schema.String,
    chain_id: Schema.optional(Schema.Number),
    usd_value: Schema.optional(Schema.NullOr(Schema.Number))
  })),
  aggregations: Schema.optional(Schema.Struct({
    total_usd_value: Schema.optional(Schema.Number),
    total_by_chain: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Number }))
  })),
  warnings: Schema.optional(Schema.Array(warningSchema))
});

export const stablecoinsResponseSchema = Schema.Struct({
  wallet_address: Schema.String,
  balances: Schema.Array(balanceDataSchema),
  errors: Schema.optional(Schema.NullOr(Schema.Union(duneErrorSchema, Schema.Array(duneErrorSchema)))),
  warnings: Schema.optional(Schema.Array(warningSchema)),
  next_offset: Schema.optional(Schema.String),
  request_time: Schema.optional(Schema.NullOr(Schema.String)),
  response_time: Schema.optional(Schema.NullOr(Schema.String))
});

// Query schemas
export const evmTransactionsQuerySchema = Schema.Struct({
  ...paginationQuerySchema.fields,
  chain_ids: Schema.optional(Schema.String)
});

export const evmBalancesQuerySchema = Schema.Struct({
  ...paginationQuerySchema.fields,
  chain_ids: Schema.optional(Schema.String),
  filters: Schema.optional(Schema.Literal('erc20', 'native')),
  exclude_spam_tokens: Schema.optional(BooleanFromString),
  historical_prices: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.String)
});

export const evmActivityQuerySchema = Schema.Struct({
  ...paginationQuerySchema.fields,
  chain_ids: Schema.optional(Schema.String),
  token_address: Schema.optional(Schema.String),
  activity_type: Schema.optional(Schema.String),
  asset_type: Schema.optional(Schema.String)
});

export const evmCollectiblesQuerySchema = Schema.Struct({
  ...paginationQuerySchema.fields,
  chain_ids: Schema.optional(Schema.String),
  filter_spam: Schema.optional(BooleanFromString),
  show_spam_scores: Schema.optional(BooleanFromString)
});

export const evmStablecoinsQuerySchema = Schema.Struct({
  ...paginationQuerySchema.fields,
  chain_ids: Schema.optional(Schema.String),
  filters: Schema.optional(Schema.Literal('erc20', 'native')),
  metadata: Schema.optional(Schema.String),
  exclude_spam_tokens: Schema.optional(BooleanFromString),
  historical_prices: Schema.optional(Schema.String)
});

export const evmTokenInfoQuerySchema = Schema.Struct({
  ...paginationQuerySchema.fields,
  chain_ids: Schema.String.pipe(Schema.minLength(1, { message: () => 'Exactly one chain ID is required by upstream' })),
  historical_prices: Schema.optional(Schema.String)
});

export const evmTokenHoldersQuerySchema = Schema.Struct({
  limit: Schema.optional(
    Schema.NumberFromString.pipe(Schema.filter(n => n >= 1 && n <= 500, { message: () => 'limit must be between 1 and 500' }))
  ),
  offset: Schema.optional(Schema.String)
});

export const evmDefiPositionsQuerySchema = Schema.Struct({
  chain_ids: Schema.optional(Schema.String)
});

// Type exports for TypeScript usage
export type ChainEntry = Schema.Schema.Type<typeof chainEntrySchema>;
export type Transaction = Schema.Schema.Type<typeof transactionSchema>;
export type BalanceData = Schema.Schema.Type<typeof balanceDataSchema>;
export type TransactionsResponse = Schema.Schema.Type<typeof transactionsResponseSchema>;
export type BalancesResponse = Schema.Schema.Type<typeof balancesResponseSchema>;
export type ActivityResponse = Schema.Schema.Type<typeof activityResponseSchema>;
export type CollectiblesResponse = Schema.Schema.Type<typeof collectiblesResponseSchema>;
export type TokenInfoResponse = Schema.Schema.Type<typeof tokenInfoResponseSchema>;
export type TokenHoldersResponse = Schema.Schema.Type<typeof tokenHoldersResponseSchema>;
export type DefiPositionsResponse = Schema.Schema.Type<typeof defiPositionsResponseSchema>;
export type StablecoinsResponse = Schema.Schema.Type<typeof stablecoinsResponseSchema>;
