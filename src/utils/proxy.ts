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
