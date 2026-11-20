import { generateKeyPairSync, sign } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/db/prisma.js';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'apple-test-key', use: 'sig' };

function appleToken(nonce: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', kid: 'apple-test-key', typ: 'JWT' });
  const body = encode({ iss: 'https://appleid.apple.com', aud: 'services-id', sub: 'apple-user', email: 'apple@example.com', email_verified: true, nonce, exp: 2_000_000_000 });
  return `${header}.${body}.${sign('RSA-SHA256', Buffer.from(`${header}.${body}`), keys.privateKey).toString('base64url')}`;
}

describe('Apple Services-ID callback relay', () => {
  let server: Server;
  let baseUrl: string;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    globalThis.fetch = vi.fn(async () => Response.json({ keys: [publicJwk] })) as typeof fetch;
    const { createApp } = await import('../src/app.js');
    server = createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  beforeEach(async () => {
    await prisma.appleAuthRelayResult.deleteMany();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  });

  it('relays a valid signed response as an opaque result and consumes it once', async () => {
    const start = await post('/auth/apple/relay/start', {});
    expect(start.status).toBe(200);
    const session = await start.json() as { state: string; nonce: string };
    const callback = await post('/auth/apple/callback', { state: session.state, id_token: appleToken(session.nonce) }, 'manual');
    expect(callback.status).toBe(303);
    const location = callback.headers.get('location') ?? '';
    expect(location).toMatch(/^dispute:\/\/oauth\/apple\?result=/);
    expect(location).not.toContain('id_token');
    const result = new URL(location).searchParams.get('result');
    expect(result).toBeTruthy();

    const login = await post('/auth/social-login', { provider: 'apple', appleRelayResult: result });
    expect(login.status).toBe(200);
    const replay = await post('/auth/social-login', { provider: 'apple', appleRelayResult: result });
    expect(replay.status).toBe(401);
  });

  it('rejects an unknown callback state without issuing a redirect', async () => {
    const response = await post('/auth/apple/callback', { state: 'unknown', id_token: appleToken('nonce') }, 'manual');
    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
  });

  it('rejects malformed Apple form posts', async () => {
    const response = await post('/auth/apple/callback', { state: 'missing-token' }, 'manual');
    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Apple sign-in failed');
  });

  function post(path: string, body: unknown, redirect: RequestRedirect = 'follow') {
    return originalFetch(`${baseUrl}${path}`, { method: 'POST', redirect, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
});
