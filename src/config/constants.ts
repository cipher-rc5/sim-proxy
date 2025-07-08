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
