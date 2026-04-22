// src/utils/fetch.ts

import { RETRY_CONFIG } from '../config/constants';
import type { Logger } from './logger';

export interface FetchRetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  timeoutMs?: number;
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
    timeoutMs = RETRY_CONFIG.REQUEST_TIMEOUT_MS,
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

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)),
        timeoutMs
      );

      let response: Response;
      try {
        response = await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
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
      if (error instanceof Error && error.name === 'AbortError') {
        logger?.warn(`Fetch attempt ${attempt} timed out`, { url, timeoutMs, attempt });
      }

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
