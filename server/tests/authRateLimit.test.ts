import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuthLimiter } from '../src/modules/auth/auth.routes.js';

describe('auth rate limiting', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.get('/limited', createAuthLimiter(2, 'Slow down.', false), (_req, res) => {
      res.json({ ok: true });
    });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('rejects requests after the configured attempt limit', async () => {
    expect((await fetch(`${baseUrl}/limited`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/limited`)).status).toBe(200);
    const blocked = await fetch(`${baseUrl}/limited`);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'Slow down.' });
    expect(blocked.headers.get('ratelimit')).toBeTruthy();
  });
});
