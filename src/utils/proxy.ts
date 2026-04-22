// src/utils/proxy.ts

import { Cause, Effect, Exit, Option, Schema } from 'effect';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  CACHE_CONFIG,
  DEDUP_CONFIG,
  DUNE_SIM_BASE_ENDPOINT,
  HEADERS,
  MAX_REQUEST_BODY_SIZE,
  MAX_RESPONSE_SIZE,
  MAX_SUBREQUESTS
} from '../config/constants';
import type { ValidatedEnv } from '../config/env';
import {
  BodyTooLargeError,
  FetchNetworkError,
  UpstreamParseError,
  UpstreamSchemaError,
  type ProxyError
} from '../types/errors';
import { serializeError } from '../types/errors';
import type { Variables } from '../types';
import { fetchWithRetry } from './fetch';
import { createChildLogger, createLogger, type Logger } from './logger';

// In-flight request deduplication map (keyed by method:url)
const inFlightRequests = new Map<string, Promise<Response>>();

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

function shouldDeduplicate(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

/**
 * Map a typed `ProxyError` to an `HTTPException` for Hono's error handler.
 * Pass `isDevelopment` to include schema issue details in dev environments.
 */
function proxyErrorToHttpException(error: ProxyError, isDevelopment: boolean): HTTPException {
  switch (error._tag) {
    case 'FetchTimeoutError':
      return new HTTPException(504, {
        message: `Upstream request timed out after ${error.timeoutMs}ms`
      });
    case 'FetchNetworkError':
      return new HTTPException(502, {
        message: 'Failed to connect to upstream API'
      });
    case 'UpstreamParseError':
      return new HTTPException(502, {
        message: 'Invalid JSON response from upstream API'
      });
    case 'UpstreamSchemaError':
      return new HTTPException(502, {
        message: 'Invalid response schema from upstream API',
        cause: isDevelopment ? error.message : undefined
      });
    case 'BodyTooLargeError':
      return new HTTPException(413, {
        message: `${error.source === 'request' ? 'Request' : 'Response'} body too large: ${error.size} bytes exceeds ${error.limit} bytes`
      });
  }
}

/**
 * Run a `ProxyError`-typed Effect and convert typed failures to HTTPException
 * so Hono's `onError` handler can process them normally.
 */
async function runProxyEffect(
  effect: Effect.Effect<Response, ProxyError>,
  isDevelopment: boolean
): Promise<Response> {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) return exit.value;

  // Expected failure in the typed error channel
  const failure = Cause.failureOption(exit.cause);
  if (Option.isSome(failure)) {
    throw proxyErrorToHttpException(failure.value, isDevelopment);
  }

  // Unexpected defect (programming error or unhandled exception)
  throw new HTTPException(500, { message: 'Internal proxy error' });
}

// ---------------------------------------------------------------------------
// Internal Effect pipeline
// ---------------------------------------------------------------------------

/**
 * Read and validate a request body, failing with `BodyTooLargeError` if the
 * body exceeds `maxSize`, or `FetchNetworkError` if reading fails.
 */
function readRequestBodyWithLimit(
  request: Request,
  maxSize: number
): Effect.Effect<string, BodyTooLargeError | FetchNetworkError> {
  return Effect.gen(function* () {
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const parsed = Number.parseInt(contentLength, 10);
      if (Number.isFinite(parsed) && parsed > maxSize) {
        return yield* Effect.fail(
          new BodyTooLargeError({ size: parsed, limit: maxSize, source: 'request' })
        );
      }
    }

    const bodyText = yield* Effect.tryPromise({
      try: () => request.text(),
      catch: (e) => new FetchNetworkError({ url: request.url, cause: e })
    });

    const bodySize = new TextEncoder().encode(bodyText).byteLength;
    if (bodySize > maxSize) {
      return yield* Effect.fail(
        new BodyTooLargeError({ size: bodySize, limit: maxSize, source: 'request' })
      );
    }

    return bodyText;
  });
}

/**
 * Stream and buffer the response body with a size cap.
 * Parses JSON and returns the raw text alongside for error reporting.
 * Fails with `BodyTooLargeError`, `FetchNetworkError`, or `UpstreamParseError`.
 */
function processResponse(
  response: Response,
  logger: Logger
): Effect.Effect<
  { data: unknown; bodyText: string; totalSize: number },
  BodyTooLargeError | FetchNetworkError | UpstreamParseError
> {
  if (!response.body) {
    return Effect.succeed({ data: null, bodyText: '', totalSize: 0 });
  }

  return Effect.gen(function* () {
    // Buffer the stream with size enforcement
    const { bodyText, totalSize } = yield* Effect.tryPromise({
      try: async () => {
        const chunks: Uint8Array[] = [];
        let size = 0;
        const reader = response.body!.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > MAX_RESPONSE_SIZE) {
              reader.cancel();
              throw new BodyTooLargeError({ size, limit: MAX_RESPONSE_SIZE, source: 'response' });
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }

        const bodyArray = new Uint8Array(size);
        let pos = 0;
        for (const chunk of chunks) {
          bodyArray.set(chunk, pos);
          pos += chunk.length;
        }

        return { bodyText: new TextDecoder().decode(bodyArray), totalSize: size };
      },
      catch: (e): BodyTooLargeError | FetchNetworkError => {
        if (e instanceof BodyTooLargeError) {
          logger.error('Response size exceeded limit', { totalSize: e.size, limit: e.limit });
          return e;
        }
        return new FetchNetworkError({ url: '', cause: e });
      }
    });

    // Parse JSON — failure means upstream sent unparseable content
    return yield* Effect.try({
      try: (): { data: unknown; bodyText: string; totalSize: number } => ({
        data: JSON.parse(bodyText),
        bodyText,
        totalSize
      }),
      catch: (e) => {
        logger.error('Failed to parse upstream response as JSON', {
          error: serializeError(e),
          responseStatus: response.status,
          bodyPreview: bodyText.substring(0, 200)
        });
        return new UpstreamParseError({ preview: bodyText.substring(0, 200) });
      }
    });
  });
}

/**
 * Core proxy pipeline — fully typed error channel.
 * Fetches from upstream, validates the response schema, and returns a
 * `Response` ready to send back to the client.
 */
function executeProxyRequest<A>(
  c: Context<{ Variables: Variables }>,
  url: URL,
  headers: Headers,
  responseSchema: Schema.Schema<A>,
  logger: Logger
): Effect.Effect<Response, ProxyError> {
  const startTime = Date.now();

  return Effect.gen(function* () {
    // Read request body for non-GET methods
    let body: string | undefined;
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      body = yield* readRequestBodyWithLimit(c.req.raw, MAX_REQUEST_BODY_SIZE);
    }

    logger.info('Proxying request', {
      method: c.req.method,
      hasBody: !!body,
      bodySize: body?.length
    });

    // Proxy to upstream with retry
    const response = yield* fetchWithRetry(
      url.toString(),
      { method: c.req.method, headers, body },
      {
        logger,
        shouldRetry: (res) => {
          if (res.ok) return false;
          if (res.status === 429) return true;
          if (res.status >= 500) return res.status !== 501 && res.status !== 505;
          return false;
        }
      }
    );

    // Buffer and decode the response body
    const { data, bodyText, totalSize } = yield* processResponse(response, logger);

    if (response.ok) {
      // Validate structure against the expected schema
      const parseResult = Schema.decodeUnknownEither(responseSchema)(data);
      if (parseResult._tag === 'Left') {
        logger.error('Upstream response failed schema validation', {
          error: parseResult.left.message,
          bodyPreview: bodyText.substring(0, 500)
        });
        return yield* Effect.fail(
          new UpstreamSchemaError({ message: parseResult.left.message, preview: bodyText.substring(0, 500) })
        );
      }

      logger.info('Proxy request successful', {
        status: response.status,
        responseSize: totalSize,
        responseTime: Date.now() - startTime
      });

      // Return original data to preserve all upstream fields
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: createCacheHeaders(url.pathname)
      });
    }

    // Upstream returned a non-ok status — forward the body as-is
    logger.warn('Upstream API error', {
      status: response.status,
      statusText: response.statusText,
      responseTime: Date.now() - startTime,
      errorData: data
    });

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }).pipe(
    Effect.tapError((error) =>
      Effect.sync(() =>
        logger.error('Proxy request failed', {
          errorTag: error._tag,
          responseTime: Date.now() - startTime
        })
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Public API — Promise-based so Hono route handlers require no changes
// ---------------------------------------------------------------------------

export async function proxyRequest<A>(
  c: Context<{ Variables: Variables }>,
  path: string,
  responseSchema: Schema.Schema<A>,
  queryParams?: URLSearchParams
): Promise<Response> {
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv;
  const logger = createLogger(c);
  const requestLogger = createChildLogger(logger, { proxyPath: path });

  const url = new URL(`${DUNE_SIM_BASE_ENDPOINT}${path}`);
  if (queryParams) url.search = queryParams.toString();

  // Guard against runaway subrequest counts
  const requestCount = c.get('subrequestCount') ?? 0;
  if (requestCount >= MAX_SUBREQUESTS) {
    requestLogger.error('Subrequest limit exceeded', {
      limit: MAX_SUBREQUESTS,
      current: requestCount
    });
    throw new HTTPException(429, {
      message: 'Too many subrequests in this request',
      cause: { limit: MAX_SUBREQUESTS, current: requestCount }
    });
  }
  c.set('subrequestCount', requestCount + 1);

  // Deduplication for idempotent methods
  const requestKey = `${c.req.method}:${url.toString()}`;
  const canDeduplicate = shouldDeduplicate(c.req.method);

  if (canDeduplicate) {
    const inFlight = inFlightRequests.get(requestKey);
    if (inFlight) {
      requestLogger.debug('Reusing in-flight request');
      try {
        const response = await inFlight;
        return response.clone();
      } catch (error) {
        requestLogger.debug('In-flight request failed, making new request', {
          error: serializeError(error)
        });
      }
    }
  }

  const requestHeaders = new Headers({
    [HEADERS.API_KEY]: validatedEnv.DUNE_SIM_API_KEY,
    'Content-Type': 'application/json',
    [HEADERS.REQUEST_ID]: c.get('requestId'),
    'User-Agent': `Dune-Sim-Proxy/1.0 (+https://github.com/cipher-rc5)`
  });

  const effect = executeProxyRequest(c, url, requestHeaders, responseSchema, requestLogger);
  const isDevelopment = validatedEnv.NODE_ENV === 'development';

  const responsePromise = runProxyEffect(effect, isDevelopment);

  if (canDeduplicate) {
    inFlightRequests.set(requestKey, responsePromise);
    setTimeout(() => inFlightRequests.delete(requestKey), DEDUP_CONFIG.CLEANUP_DELAY);
  }

  return responsePromise;
}

