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
