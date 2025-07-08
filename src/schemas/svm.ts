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
