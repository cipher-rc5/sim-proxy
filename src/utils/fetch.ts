// src/utils/fetch.ts

import { Duration, Effect } from 'effect';
import { RETRY_CONFIG } from '../config/constants';
import { FetchNetworkError, FetchTimeoutError } from '../types/errors';
import type { Logger } from './logger';

export interface FetchRetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  timeoutMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (response: Response) => boolean;
  logger?: Logger;
}

// Exponential backoff with ±25% jitter
function calculateDelay(attempt: number, initialDelay: number, maxDelay: number, backoffMultiplier: number): number {
  const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  const clamped = Math.min(exponentialDelay, maxDelay);
  const jitter = clamped * 0.25 * (Math.random() * 2 - 1);
  return Math.round(clamped + jitter);
}

function defaultShouldRetry(response: Response): boolean {
  if (response.ok) return false;
  if (RETRY_CONFIG.NON_RETRYABLE_STATUS.has(response.status)) return false;
  return response.status >= 500 || response.status === 429;
}

// Single HTTP attempt — typed failure on timeout or network error
function makeRequest(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Effect.Effect<Response, FetchTimeoutError | FetchNetworkError> {
  return Effect.tryPromise({
    try: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
    },
    catch: (e): FetchTimeoutError | FetchNetworkError =>
      e instanceof Error && e.name === 'AbortError' ?
        new FetchTimeoutError({ url, timeoutMs }) :
        new FetchNetworkError({ url, cause: e })
  });
}

/**
 * Fetch with typed exponential-backoff retry.
 *
 * Returns `Effect<Response, FetchTimeoutError | FetchNetworkError>`.
 * HTTP-level retry (429, 5xx) is governed by `shouldRetry`.
 * When all attempts are exhausted after an HTTP-retryable response,
 * the last Response is returned as a success so callers can inspect status.
 */
export function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions: FetchRetryOptions = {}
): Effect.Effect<Response, FetchTimeoutError | FetchNetworkError> {
  const maxRetries = retryOptions.maxRetries ?? RETRY_CONFIG.MAX_RETRIES;
  const initialDelay = retryOptions.initialDelay ?? RETRY_CONFIG.INITIAL_DELAY;
  const maxDelay = retryOptions.maxDelay ?? RETRY_CONFIG.MAX_DELAY;
  const timeoutMs = retryOptions.timeoutMs ?? RETRY_CONFIG.REQUEST_TIMEOUT_MS;
  const backoffMultiplier = retryOptions.backoffMultiplier ?? RETRY_CONFIG.BACKOFF_MULTIPLIER;
  const shouldRetry = retryOptions.shouldRetry ?? defaultShouldRetry;
  const logger = retryOptions.logger;

  const loop = (
    attempt: number,
    lastResponse: Response | null
  ): Effect.Effect<Response, FetchTimeoutError | FetchNetworkError> =>
    Effect.gen(function*() {
      // All retries exhausted
      if (attempt > maxRetries) {
        if (lastResponse) return lastResponse;
        return yield* Effect.fail(
          new FetchNetworkError({ url, cause: new Error(`Failed to fetch after ${maxRetries} attempts`) })
        );
      }

      logger?.debug(`Fetching URL (attempt ${attempt}/${maxRetries})`, { url, method: options.method ?? 'GET' });

      // Attempt the request; on network error optionally retry with backoff
      const response = yield* makeRequest(url, options, timeoutMs).pipe(Effect.catchAll((networkError) => {
        logger?.warn(`Fetch attempt ${attempt} failed`, { url, error: networkError.message, attempt });
        if (attempt >= maxRetries) return Effect.fail(networkError);
        const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
        logger?.info(`Retrying after network error (${delay}ms)`, { url, attempt });
        return Effect.sleep(Duration.millis(delay)).pipe(Effect.flatMap(() => loop(attempt + 1, null)));
      }));

      // HTTP-level retry (429, 5xx, etc.)
      if (attempt < maxRetries && shouldRetry(response)) {
        const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
        logger?.info(`Retrying request after ${delay}ms`, {
          url,
          attempt,
          status: response.status,
          statusText: response.statusText
        });
        return yield* Effect.sleep(Duration.millis(delay)).pipe(Effect.flatMap(() => loop(attempt + 1, response)));
      }

      return response;
    });

  return loop(1, null);
}

/**
 * Partially apply retry defaults, returning an Effect-producing fetch function.
 */
export function createRetryableFetch(defaultOptions: FetchRetryOptions) {
  return (
    url: string,
    options: RequestInit,
    overrideOptions?: FetchRetryOptions
  ): Effect.Effect<Response, FetchTimeoutError | FetchNetworkError> =>
    fetchWithRetry(url, options, { ...defaultOptions, ...overrideOptions });
}
