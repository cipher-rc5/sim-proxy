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

// OpenAPI documentation endpoint — servers array is derived from the request
// so Scalar always points at the actual instance (localhost, staging, or prod)
app.get('/openapi.json', (c) => {
  const origin = new URL(c.req.url).origin;
  const spec = {
    ...openAPISpec,
    servers: [{ url: origin, description: 'This instance' }]
  };
  c.header(HEADERS.CACHE_CONTROL, `public, max-age=${CACHE_CONFIG.DOCUMENTATION_TTL}`);
  return c.json(spec);
});

// Convenience routes for browsers
app.get('/', (c) => c.redirect('/docs', 302));
app.get('/favicon.svg', (c) => {
  const svg = `<svg width="1200" height="1200" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="1200" height="1200" fill="#0F0F15"/>
<path d="M1050.21 604.077C1048.55 779.14 944.207 944.627 772.259 1015.85C600.31 1087.07 409.51 1043.84 284.544 921.227L1050.21 604.077Z" fill="white"/>
<path d="M427.757 184.15C657.424 89.0195 920.727 198.083 1015.86 427.75C1029.79 461.391 1039.34 495.755 1044.77 530.205L236.158 865.145C215.641 836.942 198.092 805.893 184.157 772.252C89.0262 542.584 198.089 279.282 427.757 184.15Z" fill="white"/>
</svg>`;
  c.header(HEADERS.CACHE_CONTROL, `public, max-age=${CACHE_CONFIG.DOCUMENTATION_TTL}`);
  return c.body(svg, 200, { 'Content-Type': 'image/svg+xml' });
});
app.get('/favicon.ico', (c) => c.redirect('/favicon.svg', 301));

// Scalar API Reference — Acid & Bone theme
app.get(
  '/docs',
  Scalar({
    url: '/openapi.json',
    layout: 'modern',
    theme: 'none',
    hideModels: false,
    showSidebar: true,
    searchHotKey: 'k',
    customCss: `
      /* ── Layout & Spacing ───────────────────────────────────────────── */
      :root {
        --scalar-header-height: 50px;
        --scalar-sidebar-width: 280px;
        --scalar-container-width: 680px;
        --scalar-toc-width: 280px;
        --scalar-card-icon-width: 40px;
        --scalar-card-icon-height: 40px;
        --scalar-card-icon-diameter: 20px;
        --scalar-card-padding: 16px;
        --scalar-card-inter-element-gap: 4px;
        --scalar-toc-indent-unit: 16px;
        --scalar-row-gap: 16px;
        --scalar-extra-bold: 700;
        --scalar-heading-spacing: 44px;
        --scalar-block-spacing: 12px;
        --scalar-font-size-1: 24px;
        --scalar-text-decoration: none;
        --scalar-text-decoration-hover: underline;
        --scalar-radius: 0px;
        --scalar-radius-lg: 0px;
        --scalar-radius-xl: 0px;
      }

      /* ── Light Mode ─────────────────────────────────────────────────── */
      .light-mode {
        /* Backgrounds */
        --scalar-background-1: #f2efe9;
        --scalar-background-2: #e8e5de;
        --scalar-background-3: #dbd8d0;
        --scalar-background-accent: rgba(220, 238, 36, 0.15);

        /* Text */
        --scalar-color-1: #141414;
        --scalar-color-2: #454545;
        --scalar-color-3: #787878;
        --scalar-color-accent: #141414;

        /* Borders & Buttons */
        --scalar-border-color: #dbd8d0;
        --scalar-button-1: #141414;
        --scalar-button-1-hover: #000000;
        --scalar-button-1-color: #dcee24;

        /* Status */
        --scalar-color-green: #2fa86d;
        --scalar-color-red: #d92b2b;
        --scalar-color-yellow: #e6b800;
        --scalar-color-blue: #2b7dd9;
        --scalar-color-orange: #e66a00;
        --scalar-color-purple: #7a2bd9;

        /* Links & Tooltips */
        --scalar-link-color: var(--scalar-color-1);
        --scalar-link-color-hover: #dcee24;
        --scalar-tooltip-background: #141414;
        --scalar-tooltip-color: #dcee24;
      }

      /* ── Dark Mode ──────────────────────────────────────────────────── */
      .dark-mode {
        /* Backgrounds */
        --scalar-background-1: #141414;
        --scalar-background-2: #1f1f1f;
        --scalar-background-3: #2a2a2a;
        --scalar-background-accent: rgba(220, 238, 36, 0.15);

        /* Text */
        --scalar-color-1: #f2efe9;
        --scalar-color-2: #a1a1a1;
        --scalar-color-3: #666666;
        --scalar-color-accent: #dcee24;

        /* Borders & Buttons */
        --scalar-border-color: #2a2a2a;
        --scalar-button-1: #dcee24;
        --scalar-button-1-hover: #c9db1f;
        --scalar-button-1-color: #141414;

        /* Status */
        --scalar-color-green: #dcee24;
        --scalar-color-red: #ff4d4d;
        --scalar-color-yellow: #ffd633;
        --scalar-color-blue: #4da6ff;
        --scalar-color-orange: #ff944d;
        --scalar-color-purple: #b366ff;

        /* Links & Tooltips */
        --scalar-link-color: var(--scalar-color-accent);
        --scalar-link-color-hover: #ffffff;
        --scalar-tooltip-background: #f2efe9;
        --scalar-tooltip-color: #141414;
      }

      /* ── Sidebar (both modes) ───────────────────────────────────────── */
      .light-mode, .dark-mode {
        --scalar-sidebar-background-1: var(--scalar-background-2);
        --scalar-sidebar-color-1: var(--scalar-color-1);
        --scalar-sidebar-color-2: var(--scalar-color-2);
        --scalar-sidebar-border-color: var(--scalar-border-color);
        --scalar-sidebar-item-hover-background: var(--scalar-background-3);
        --scalar-sidebar-item-hover-color: currentColor;
        --scalar-sidebar-item-active-background: var(--scalar-background-1);
        --scalar-sidebar-color-active: var(--scalar-color-1);
        --scalar-sidebar-indent-border: var(--scalar-sidebar-border-color);
        --scalar-sidebar-indent-border-hover: var(--scalar-sidebar-border-color);
        --scalar-sidebar-indent-border-active: var(--scalar-color-accent);
        --scalar-sidebar-search-background: var(--scalar-background-1);
        --scalar-sidebar-search-color: var(--scalar-color-1);
        --scalar-sidebar-search-border-color: var(--scalar-border-color);

        /* Header */
        --scalar-header-background-1: var(--scalar-background-1);
        --scalar-header-border-color: var(--scalar-border-color);
        --scalar-header-color-1: var(--scalar-color-1);
        --scalar-header-color-2: var(--scalar-color-2);
        --scalar-header-background-toggle: var(--scalar-background-3);
        --scalar-header-call-to-action-color: var(--scalar-button-1-color);
      }
    `
  })
);

// Alternative Scalar endpoint
app.get('/scalar', (c) => c.redirect('/docs', 301));

interface OpenApiParameter {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: { type?: string };
}

interface OpenApiOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenApiParameter[];
}

// Enhanced markdown documentation generator
function generateMarkdownFromSpec(spec: typeof openAPISpec): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${spec.info.title}`);
  lines.push(`Version: ${spec.info.version}\n`);
  lines.push(`${spec.info.description}\n`);

  lines.push('## Upstream Sim AI Docs\n');
  lines.push('- Documentation index: `https://docs.sim.dune.com/llms.txt`');
  lines.push('- Full docs corpus: `https://docs.sim.dune.com/llms-full.txt`');
  lines.push('- Build with AI guide: `https://docs.sim.dune.com/build-with-ai.md`\n');

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

  const endpointsByTag = new Map<string, Array<{ path: string, method: string, details: OpenApiOperation }>>();

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, details] of Object.entries(methods as Record<string, OpenApiOperation>)) {
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
      if ((details.parameters?.length ?? 0) > 0) {
        lines.push('**Parameters:**\n');
        lines.push('| Name | Type | In | Required | Description |');
        lines.push('|------|------|----|----------|-------------|');
        for (const param of details.parameters!) {
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
app.onError((err, c) => errorHandler(err, c));

// 404 handler
app.notFound((c) => notFoundHandler(c));

// Export for Cloudflare Workers
export default app;
