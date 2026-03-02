# Dune Sim API Cloudflare Worker Proxy

Cloudflare Worker that proxies requests to the Dune Sim API with comprehensive validation, authentication, and documentation

(Project is still under extensive development, do not use in production yet)

## Features

- Secure API key authentication using Bearer tokens
- Built with Bun and Hono for optimal performance
- Full support for EVM and SVM endpoints
- Includes EVM Activity endpoint support
- Baseline automated tests using Bun's native test runner
- Cryptographically secure API key generation
- CORS enabled for browser-based applications
- Zod validation for all inputs and outputs
- T3 Env for type-safe environment variables
- Self-hosted Scalar API documentation
- Full TypeScript support with strict typing

## Prerequisites

- [Bun](https://bun.sh/) installed
- [Cloudflare Workers](https://workers.cloudflare.com/) account
- Dune Sim API key

## Installation

1. Clone the repository and install dependencies:

```bash
bun install
```

to manually install dependencies

```bash
bun add hono @hono/zod-validator @scalar/hono-api-reference zod @t3-oss/env-core
```

2. Generate a secure API key for your worker:

```bash
bun run generate-key
```

This will output a cryptographically secure API key. Save this key securely!

3. Create a `.env` file from the example:

```bash
cp .env.example .env
```

4. Add your keys to the `.env` file:

```env
DUNE_SIM_API_KEY=your_dune_sim_api_key_here
WORKER_API_KEY=your_generated_worker_api_key_here
```

## Development

Run the worker locally:

```bash
bun run dev
```

## Testing

Run the test suite:

```bash
bun test
```

Watch mode for development:

```bash
bun test --watch
```

## Deployment

1. Configure your Cloudflare account:

```bash
npx wrangler login
```

2. Set your secrets in Cloudflare:

```bash
npx wrangler secret put DUNE_SIM_API_KEY
npx wrangler secret put WORKER_API_KEY
```

3. Deploy the worker:

```bash
bun run deploy
```

## API Documentation

The worker includes self-hosted API documentation powered by Scalar. Once deployed, you can access:

- **Interactive API Docs**: `https://your-worker.workers.dev/docs`
- **OpenAPI Spec**: `https://your-worker.workers.dev/openapi.json`
- **Upstream Sim docs index**: `https://docs.sim.dune.com/llms.txt`
- **Upstream Sim full docs**: `https://docs.sim.dune.com/llms-full.txt`

The documentation includes:

- Complete endpoint descriptions
- Request/response schemas
- Try-it-out functionality
- Authentication requirements
- Example requests and responses

### Available Endpoints

#### EVM Endpoints

1. **Get Supported Chains**

```bash
curl -H "Authorization: Bearer YOUR_WORKER_API_KEY" \
  https://your-worker.workers.dev/v1/evm/supported-chains/balances
```

2. **Get EVM Transactions**

```bash
curl -H "Authorization: Bearer YOUR_WORKER_API_KEY" \
  "https://your-worker.workers.dev/v1/evm/transactions/0xYOUR_ADDRESS?chain_ids=1,10&limit=100"
```

3. **Get EVM Balances**

```bash
curl -H "Authorization: Bearer YOUR_WORKER_API_KEY" \
  "https://your-worker.workers.dev/v1/evm/balances/0xYOUR_ADDRESS?chain_ids=mainnet"
```

4. **Get EVM Activity**

```bash
curl -H "Authorization: Bearer YOUR_WORKER_API_KEY" \
  "https://your-worker.workers.dev/v1/evm/activity/0xYOUR_ADDRESS?chain_ids=1&limit=50"
```

5. **Get EVM Collectibles**

```bash
curl -H "Authorization: Bearer YOUR_WORKER_API_KEY" \
  "https://your-worker.workers.dev/v1/evm/collectibles/0xYOUR_ADDRESS?chain_ids=1&limit=100"
```

6. **Get Stablecoin Balances**

```bash
curl -H "Authorization: Bearer YOUR_WORKER_API_KEY" \
  "https://your-worker.workers.dev/v1/evm/stablecoins/0xYOUR_ADDRESS?chain_ids=1"
```

7. **Get Token Info**

```bash
curl -H "Authorization: Bearer YOUR_WORKER_API_KEY" \
  "https://your-worker.workers.dev/v1/evm/token-info/native?chain_ids=1"
```

8. **Get Token Holders**

```bash
curl -H "Authorization: Bearer YOUR_WORKER_API_KEY" \
  "https://your-worker.workers.dev/v1/evm/token-holders/1/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48?limit=100"
```

9. **Get DeFi Positions**

```bash
curl -H "Authorization: Bearer YOUR_WORKER_API_KEY" \
  "https://your-worker.workers.dev/v1/evm/defi-positions/0xYOUR_ADDRESS?chain_ids=1"
```

#### SVM Endpoints (Beta)

1. **Get SVM Transactions**

```bash
curl -H "Authorization: Bearer YOUR_WORKER_API_KEY" \
  "https://your-worker.workers.dev/beta/svm/transactions/YOUR_SOLANA_ADDRESS?limit=10"
```

2. **Get SVM Balances**

```bash
curl -H "Authorization: Bearer YOUR_WORKER_API_KEY" \
  "https://your-worker.workers.dev/beta/svm/balances/YOUR_SOLANA_ADDRESS?chains=solana"
```

#### Health Check

```bash
curl -H "Authorization: Bearer YOUR_WORKER_API_KEY" \
  https://your-worker.workers.dev/health
```

## Validation & Security

### Environment Variables

All environment variables are validated using [@t3-oss/env-core](https://github.com/t3-oss/t3-env):

- `DUNE_SIM_API_KEY`: Your Dune Sim API key (required)
- `WORKER_API_KEY`: Generated worker API key (min 32 characters)
- `NODE_ENV`: Environment mode (development/production/test)

### Request Validation

All requests are validated using Zod schemas:

- EVM addresses must match `0x[40 hex chars]` format
- SVM addresses must be 32-44 characters
- Query parameters are strictly typed and validated
- Response data from upstream API is validated before returning

### Error Handling

Comprehensive error handling with detailed messages:

- `400`: Validation errors with specific details
- `401`: Authentication failures
- `404`: Route not found
- `500`: Internal server errors
- `502`: Upstream API validation failures

## Error Responses

The API returns standard HTTP status codes:

- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized (missing or invalid token)
- `404`: Not Found
- `500`: Internal Server Error

Error response format:

```json
{ "error": "Error message here" }
```

## Project Structure

The codebase is organized into modular components for better maintainability:

```
src/
├── index.ts              # Main application entry point
├── config/
│   ├── constants.ts      # Application constants
│   ├── env.ts           # Environment validation with T3 Env
│   └── openapi.ts       # OpenAPI specification
├── middleware/
│   ├── auth.ts          # Bearer token authentication
│   └── error.ts         # Global error handler
├── routes/
│   ├── system.ts        # System routes (health check)
│   ├── evm.ts           # EVM-related endpoints
│   └── svm.ts           # SVM-related endpoints
├── schemas/
│   ├── common.ts        # Shared schemas
│   ├── evm.ts           # EVM validation schemas
│   ├── svm.ts           # SVM validation schemas
│   └── system.ts        # System schemas
├── utils/
│   └── proxy.ts         # Request proxy utility
└── types/
    └── index.ts         # TypeScript type definitions
```

This modular structure provides:

- **Separation of Concerns**: Each module has a specific responsibility
- **Easy Testing**: Individual components can be tested in isolation
- **Better Scalability**: New features can be added without touching existing code
- **Type Safety**: Centralized type definitions and schemas
- **Maintainability**: Clear file organization makes navigation easier

## Performance & Architecture

- **Bun Runtime**: Leverages Bun's fast JavaScript runtime
- **Hono Framework**: Lightweight and performant routing
- **Streaming Responses**: Efficient memory usage for large responses
- **Type Safety**: Full TypeScript with strict mode
- **Minimal Dependencies**: Fast cold starts on Cloudflare Workers
- **Response Validation**: Ensures data integrity from upstream API

## Testing

The project includes baseline tests for:

- Authentication flows
- Input validation
- API proxying
- Error scenarios
- Environment validation
- OpenAPI documentation

Run tests with:

```bash
bun test              # Run all tests
bun test --watch      # Watch mode
bun run type-check    # TypeScript validation
bun run build         # Build validation
```

## License

MIT

generate llm.md

```sh
repomix --style markdown -o llm.md --no-file-summary --verbose
```
