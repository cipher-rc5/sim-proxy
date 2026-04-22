// src/schemas/svm.ts

import { Schema } from 'effect';
import { paginationQuerySchema } from './common';

export const svmAddressSchema = Schema.String.pipe(
  Schema.minLength(32),
  Schema.maxLength(44)
);

export const svmTransactionSchema = Schema.Struct({
  address: Schema.String,
  block_slot: Schema.Number,
  block_time: Schema.Number,
  chain: Schema.String,
  raw_transaction: Schema.Record({ key: Schema.String, value: Schema.Unknown })
});

export const svmTransactionsResponseSchema = Schema.Struct({
  transactions: Schema.Array(svmTransactionSchema),
  next_offset: Schema.optional(Schema.NullOr(Schema.String))
});

export const svmBalanceItemSchema = Schema.Struct({
  chain: Schema.String,
  address: Schema.String,
  amount: Schema.String,
  balance: Schema.optional(Schema.String),
  value_usd: Schema.optional(Schema.NullOr(Schema.Number)),
  program_id: Schema.optional(Schema.NullOr(Schema.String)),
  decimals: Schema.optional(Schema.NullOr(Schema.Number)),
  total_supply: Schema.optional(Schema.NullOr(Schema.String)),
  name: Schema.optional(Schema.NullOr(Schema.String)),
  symbol: Schema.optional(Schema.NullOr(Schema.String)),
  uri: Schema.optional(Schema.NullOr(Schema.String)),
  price_usd: Schema.optional(Schema.NullOr(Schema.Number)),
  liquidity_usd: Schema.optional(Schema.NullOr(Schema.Number)),
  pool_type: Schema.optional(Schema.NullOr(Schema.String)),
  pool_address: Schema.optional(Schema.NullOr(Schema.String)),
  mint_authority: Schema.optional(Schema.NullOr(Schema.String))
});

export const svmBalancesResponseSchema = Schema.Struct({
  wallet_address: Schema.String,
  balances: Schema.Array(svmBalanceItemSchema),
  next_offset: Schema.optional(Schema.NullOr(Schema.String)),
  processing_time_ms: Schema.optional(Schema.Number),
  balances_count: Schema.optional(Schema.Number)
});

export const svmQuerySchema = Schema.Struct({
  ...paginationQuerySchema.fields,
  chains: Schema.optional(Schema.String)
});

// Type exports
export type SvmTransaction = Schema.Schema.Type<typeof svmTransactionSchema>;
export type SvmBalanceItem = Schema.Schema.Type<typeof svmBalanceItemSchema>;
export type SvmTransactionsResponse = Schema.Schema.Type<typeof svmTransactionsResponseSchema>;
export type SvmBalancesResponse = Schema.Schema.Type<typeof svmBalancesResponseSchema>;
