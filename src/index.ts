// src/index.ts

import { Scalar } from '@scalar/hono-api-reference';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import { CACHE_CONFIG, HEADERS, RATE_LIMIT_DEFAULTS } from './config/constants';
import { parseAllowedOrigins, type ValidatedEnv } from './config/env';
import { openAPISpec } from './config/openapi';
import { authMiddleware } from './middleware/auth';
import { envMiddleware } from './middleware/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { createRateLimiter } from './middleware/rateLimit';
import { requestIdMiddleware } from './middleware/requestId';
import { evmRoutes } from './routes/evm';
import { svmRoutes } from './routes/svm';
import { systemRoutes } from './routes/system';
import type { Env, Variables } from './types';
import { createLogger } from './utils/logger';

// Initialize Hono app with proper types
const app = new Hono<{ Bindings: Env, Variables: Variables }>();

// Environment validation middleware - must be first
app.use('*', envMiddleware);

// Request ID middleware - early in chain
app.use('*', requestIdMiddleware);

// Timing middleware for performance monitoring
app.use('*', timing());

// Logging middleware
app.use('*', logger());

// Security headers
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"]
    },
    crossOriginEmbedderPolicy: false, // Disabled for API
    crossOriginOpenerPolicy: false, // Disabled for API
    crossOriginResourcePolicy: false, // Disabled for API
    originAgentCluster: '?1',
    referrerPolicy: 'no-referrer',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    xContentTypeOptions: 'nosniff',
    xDnsPrefetchControl: 'off',
    xDownloadOptions: 'noopen',
    xFrameOptions: 'DENY',
    xPermittedCrossDomainPolicies: 'none',
    xXssProtection: '0' // Disabled in modern browsers
  })
);

// CORS middleware with dynamic configuration
app.use('*', async (c, next) => {
  const validatedEnv = c.get('validatedEnv') as ValidatedEnv;
  const allowedOrigins = parseAllowedOrigins(validatedEnv.ALLOWED_ORIGINS);

  return cors({
    origin: (origin) => {
      // In development, allow all origins
      if (validatedEnv.NODE_ENV === 'development') return '*';

      // Check if origin is allowed
      if (allowedOrigins.includes('*')) return '*';
      if (origin && allowedOrigins.includes(origin)) return origin;

      // Default to null (disallow)
      return null;
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: [HEADERS.CONTENT_TYPE, HEADERS.AUTHORIZATION, HEADERS.REQUEST_ID],
    exposeHeaders: [
      'Content-Length',
      HEADERS.REQUEST_ID,
      HEADERS.RATE_LIMIT_LIMIT,
      HEADERS.RATE_LIMIT_REMAINING,
      HEADERS.RATE_LIMIT_RESET,
      HEADERS.RESPONSE_TIME
    ],
    maxAge: 600,
    credentials: false
  })(c, next);
});

// Rate limiting with different limits for different routes
app.use('/v1/*', createRateLimiter.api());
app.use('/beta/*', createRateLimiter.beta());
app.use('/docs', createRateLimiter.docs());
app.use('/scalar', createRateLimiter.docs());

// Authentication middleware
app.use('*', authMiddleware);

// OpenAPI documentation endpoint
app.get('/openapi.json', (c) => {
  c.header(HEADERS.CACHE_CONTROL, `public, max-age=${CACHE_CONFIG.DOCUMENTATION_TTL}`);
  return c.json(openAPISpec);
});

// Scalar API Reference
app.get(
  '/docs',
  Scalar({
    url: '/openapi.json',
    layout: 'modern',
    theme: 'purple',
    hideModels: false,
    showSidebar: true,
    searchHotKey: 'k',
    customCss: `
      .scalar-api-reference {
        --scalar-color-1: #6b21a8;
        --scalar-color-2: #a855f7;
        --scalar-color-accent: #9333ea;
        --scalar-background-1: #ffffff;
        --scalar-background-2: #fafafa;
        --scalar-background-3: #f3f4f6;
        --scalar-border-color: #e5e7eb;
      }

      @media (prefers-color-scheme: dark) {
        .scalar-api-reference {
          --scalar-background-1: #111111;
          --scalar-background-2: #1a1a1a;
          --scalar-background-3: #252525;
          --scalar-border-color: #333333;
        }
      }
    `
  })
);

// Alternative Scalar endpoint
app.get('/scalar', (c) => c.redirect('/docs', 301));

// Enhanced markdown documentation generator
function generateMarkdownFromSpec(spec: typeof openAPISpec): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${spec.info.title}`);
  lines.push(`Version: ${spec.info.version}\n`);
  lines.push(`${spec.info.description}\n`);

  // Contact & License
  if (spec.info.contact) {
    lines.push(`**Contact**: ${spec.info.contact.name} (${spec.info.contact.email})\n`);
  }
  if (spec.info.license) {
    lines.push(`**License**: [${spec.info.license.name}](${spec.info.license.url})\n`);
  }

  // Servers
  lines.push(`## Servers\n`);
  spec.servers.forEach(server => {
    lines.push(`- ${server.description}: \`${server.url}\``);
  });
  lines.push('');

  // Authentication
  lines.push(`## Authentication\n`);
  lines.push(`All API endpoints (except documentation and health) require Bearer token authentication:\n`);
  lines.push('```bash');
  lines.push('curl -H "Authorization: Bearer your_api_key" \\');
  lines.push('     https://your-worker.workers.dev/v1/evm/balances/0x...');
  lines.push('```\n');

  // Rate Limits
  lines.push(`## Rate Limits\n`);
  lines.push(
    `- **API endpoints** (/v1/*): ${RATE_LIMIT_DEFAULTS.API_REQUESTS} requests per ${RATE_LIMIT_DEFAULTS.API_WINDOW}`
  );
  lines.push(
    `- **Beta endpoints** (/beta/*): ${RATE_LIMIT_DEFAULTS.BETA_REQUESTS} requests per ${RATE_LIMIT_DEFAULTS.BETA_WINDOW}`
  );
  lines.push(
    `- **Documentation** (/docs, /scalar): ${RATE_LIMIT_DEFAULTS.DOCS_REQUESTS} requests per ${RATE_LIMIT_DEFAULTS.DOCS_WINDOW}\n`
  );

  // Headers
  lines.push(`## Response Headers\n`);
  lines.push(`- \`${HEADERS.REQUEST_ID}\`: Unique request identifier for tracking`);
  lines.push(`- \`${HEADERS.RATE_LIMIT_LIMIT}\`: Rate limit ceiling`);
  lines.push(`- \`${HEADERS.RATE_LIMIT_REMAINING}\`: Requests remaining in window`);
  lines.push(`- \`${HEADERS.RATE_LIMIT_RESET}\`: Unix timestamp when limit resets`);
  lines.push(`- \`${HEADERS.RESPONSE_TIME}\`: Response time in milliseconds\n`);

  // Endpoints by tag
  lines.push(`## Endpoints\n`);

  const endpointsByTag = new Map<string, Array<{ path: string, method: string, details: any }>>();

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, details] of Object.entries(methods as Record<string, any>)) {
      const tags = details.tags || ['Other'];
      for (const tag of tags) {
        if (!endpointsByTag.has(tag)) {
          endpointsByTag.set(tag, []);
        }
        endpointsByTag.get(tag)!.push({ path, method, details });
      }
    }
  }

  // Write endpoints grouped by tag
  for (const [tag, endpoints] of endpointsByTag) {
    lines.push(`### ${tag}\n`);

    for (const { path, method, details } of endpoints) {
      lines.push(`#### \`${method.toUpperCase()} ${path}\``);

      if (details.summary) {
        lines.push(`**${details.summary}**\n`);
      }

      if (details.description) {
        lines.push(`${details.description}\n`);
      }

      // Parameters
      if (details.parameters?.length > 0) {
        lines.push('**Parameters:**\n');
        lines.push('| Name | Type | In | Required | Description |');
        lines.push('|------|------|----|----------|-------------|');
        for (const param of details.parameters) {
          const required = param.required ? '✓' : '';
          const schema = param.schema?.type || 'string';
          lines.push(`| ${param.name} | ${schema} | ${param.in} | ${required} | ${param.description || '-'} |`);
        }
        lines.push('');
      }

      // Example request
      if (details.operationId) {
        lines.push('**Example Request:**');
        lines.push('```bash');
        const examplePath = path.replace('{address}', '0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
        lines.push(`curl -X ${method.toUpperCase()} \\`);
        lines.push(`  "https://your-worker.workers.dev${examplePath}" \\`);
        lines.push(`  -H "Authorization: Bearer your_api_key"`);
        lines.push('```\n');
      }

      lines.push('---\n');
    }
  }

  // Error handling
  lines.push(`## Error Responses\n`);
  lines.push(`All errors follow a consistent format:\n`);
  lines.push('```json');
  lines.push('{');
  lines.push('  "error": "Error message",');
  lines.push('  "details": "Additional context (development only)",');
  lines.push('  "requestId": "unique-request-id",');
  lines.push('  "timestamp": "2024-01-01T00:00:00.000Z"');
  lines.push('}');
  lines.push('```\n');

  lines.push(`### Common Error Codes\n`);
  lines.push('- `400` - Bad Request (validation error)');
  lines.push('- `401` - Unauthorized (missing/invalid API key)');
  lines.push('- `404` - Not Found');
  lines.push('- `429` - Too Many Requests (rate limit exceeded)');
  lines.push('- `500` - Internal Server Error');
  lines.push('- `502` - Bad Gateway (upstream API error)');

  return lines.join('\n');
}

// LLM-friendly markdown documentation
app.get('/llms.txt', async (c) => {
  const logger = createLogger(c);

  try {
    const markdown = generateMarkdownFromSpec(openAPISpec);

    return c.text(markdown, 200, {
      [HEADERS.CONTENT_TYPE]: 'text/plain; charset=utf-8',
      [HEADERS.CACHE_CONTROL]: `public, max-age=${CACHE_CONFIG.DOCUMENTATION_TTL}`
    });
  } catch (error) {
    logger.error('Failed to generate documentation', { error });
    return c.text('Failed to generate documentation', 500);
  }
});

// Mount routes
app.route('/', systemRoutes);
app.route('/v1/evm', evmRoutes);
app.route('/beta/svm', svmRoutes);

// Error handling
app.onError((err, c) => errorHandler(err, c as any));

// 404 handler
app.notFound((c) => notFoundHandler(c as any));

// Export for Cloudflare Workers
export default app;
