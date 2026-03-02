import { describe, expect, it } from 'bun:test';
import app from '../src/index';

const baseEnv = {
  DUNE_SIM_API_KEY: 'dune_sim_api_key_value',
  WORKER_API_KEY: 'abcdefghijklmnopqrstuvwxyz123456',
  NODE_ENV: 'development' as const
};

describe('application baseline behavior', () => {
  it('serves health endpoint without authentication', async () => {
    const res = await app.request('http://localhost/health', {}, baseEnv);

    expect(res.status).toBe(200);
    expect(typeof res.headers.get('x-request-id')).toBe('string');

    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(typeof body.version).toBe('string');
  });

  it('rejects protected endpoints without bearer token', async () => {
    const res = await app.request(
      'http://localhost/v1/evm/transactions/0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
      {},
      baseEnv
    );

    expect(res.status).toBe(401);
  });

  it('does not allow wildcard ALLOWED_ORIGINS in production', async () => {
    const res = await app.request('http://localhost/health', {}, {
      ...baseEnv,
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: '*'
    });

    expect(res.status).toBe(500);
  });

  it('sets CORS header only for explicitly allowed origin', async () => {
    const allowedOrigin = 'https://app.example.com';
    const disallowedRes = await app.request('http://localhost/health', {
      headers: {
        Origin: 'https://evil.example.com'
      }
    }, {
      ...baseEnv,
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: allowedOrigin
    });

    expect(disallowedRes.headers.get('access-control-allow-origin')).toBeNull();

    const allowedRes = await app.request('http://localhost/health', {
      headers: {
        Origin: allowedOrigin
      }
    }, {
      ...baseEnv,
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: allowedOrigin
    });

    expect(allowedRes.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
  });

  it('returns a hint for malformed supported-chains URLs', async () => {
    const res = await app.request(
      'http://localhost/v1/evm/supported-chains/balances/0xE8a090Cf0a138c971ffDbdf52c2B7AD2f7bCeBb6',
      {
        headers: {
          Authorization: `Bearer ${baseEnv.WORKER_API_KEY}`
        }
      },
      baseEnv
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Malformed supported-chains path');
    expect(body.hint).toContain('/v1/evm/supported-chains/{uri}');
  });
});
