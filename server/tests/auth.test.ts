import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';

process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

interface AuthUserResponse {
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
    passwordHash?: string;
  };
}

describe('auth API', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { app } = await import('../src/app.js');
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.allowance.deleteMany(),
      prisma.deduction.deleteMany(),
      prisma.paySummary.deleteMany(),
      prisma.progressClaimReport.deleteMany(),
      prisma.photoEvidence.deleteMany(),
      prisma.timeEntry.deleteMany(),
      prisma.project.deleteMany(),
      prisma.company.deleteMany(),
      prisma.workerProfile.deleteMany(),
      prisma.appSetting.deleteMany(),
      prisma.user.deleteMany()
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.$disconnect();
  });

  it('registers a worker without returning passwordHash', async () => {
    const response = await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });

    expect(response.status).toBe(201);
    const body = await jsonBody<AuthUserResponse>(response);
    expect(body.user).toMatchObject({
      email: 'worker@example.com',
      role: 'WORKER',
      status: 'ACTIVE'
    });
    expect(body.user.passwordHash).toBeUndefined();
    expect(response.headers.get('set-cookie')).toContain('claimproof_session=');

    const storedUser = await prisma.user.findUnique({
      where: { email: 'worker@example.com' },
      include: { appSetting: true }
    });
    expect(storedUser?.passwordHash).not.toBe('Password123!');
    expect(storedUser?.appSetting?.defaultCurrency).toBe('SGD');
  });

  it('rejects duplicate registration', async () => {
    await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });

    const response = await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });

    expect(response.status).toBe(409);
  });

  it('logs in with valid credentials', async () => {
    await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });

    const response = await postJson('/auth/login', {
      email: 'worker@example.com',
      password: 'Password123!'
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<AuthUserResponse>(response);
    expect(body.user.email).toBe('worker@example.com');
    expect(body.user.passwordHash).toBeUndefined();
    expect(response.headers.get('set-cookie')).toContain('claimproof_session=');
  });

  it('rejects login with the wrong password', async () => {
    await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });

    const response = await postJson('/auth/login', {
      email: 'worker@example.com',
      password: 'wrong-password'
    });

    expect(response.status).toBe(401);
  });

  it('clears auth state on logout', async () => {
    const registered = await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });
    const cookie = sessionCookie(registered);

    const response = await postJson('/auth/logout', {}, cookie);

    expect(response.status).toBe(204);
    const clearCookie = response.headers.get('set-cookie');
    expect(clearCookie).toContain('claimproof_session=');
    expect(clearCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  });

  it('rejects protected requests without auth', async () => {
    const response = await fetch(`${baseUrl}/test/protected`);

    expect(response.status).toBe(401);
  });

  it('accepts protected requests with valid auth', async () => {
    const registered = await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });
    const cookie = sessionCookie(registered);

    const response = await fetch(`${baseUrl}/test/protected`, {
      headers: { Cookie: cookie }
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<AuthUserResponse>(response);
    expect(body.user).toMatchObject({
      email: 'worker@example.com',
      role: 'WORKER'
    });
  });

  function postJson(path: string, body: unknown, cookie?: string): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {})
      },
      body: JSON.stringify(body)
    });
  }
});

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  expect(setCookie).toBeTruthy();
  return setCookie?.split(';')[0] ?? '';
}

async function jsonBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
