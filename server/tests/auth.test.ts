import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Router } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { requireUser } from '../src/middleware/requireUser.js';

process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

interface AuthUserResponse {
  devVerificationCode: string;
  devVerificationToken: string;
  verificationRequired?: boolean;
  message?: string;
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
    const { createApp } = await import('../src/app.js');
    const testRouter = Router();
    testRouter.get('/protected', requireUser, (req, res) => {
      res.json({ user: req.user });
    });

    server = createServer(createApp({ testRouter }));
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
      prisma.emailVerificationToken.deleteMany(),
      prisma.userSubscription.deleteMany(),
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

  it('registers a worker as pending email verification without returning passwordHash', async () => {
    const response = await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });

    expect(response.status).toBe(201);
    const body = await jsonBody<AuthUserResponse>(response);
    expect(body.user).toMatchObject({
      email: 'worker@example.com',
      role: 'WORKER',
      status: 'PENDING_EMAIL_VERIFICATION'
    });
    expect(body.verificationRequired).toBe(true);
    expect(body.devVerificationCode).toMatch(/^\d{6}$/);
    expect(body.user.passwordHash).toBeUndefined();
    expect(response.headers.get('set-cookie')).toBeNull();

    const storedUser = await prisma.user.findUnique({
      where: { email: 'worker@example.com' },
      include: { appSetting: true, emailVerificationTokens: true }
    });
    expect(storedUser?.passwordHash).not.toBe('Password123!');
    expect(storedUser?.emailVerifiedAt).toBeNull();
    expect(storedUser?.appSetting?.defaultCurrency).toBe('SGD');
    expect(storedUser?.emailVerificationTokens).toHaveLength(1);
  });

  it('resends verification code for duplicate pending registration', async () => {
    await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });

    const response = await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });

    expect(response.status).toBe(201);
    const body = await jsonBody<AuthUserResponse>(response);
    expect(body.verificationRequired).toBe(true);
    expect(body.message).toContain('new verification code');

    const storedUser = await prisma.user.findUnique({
      where: { email: 'worker@example.com' },
      include: { emailVerificationTokens: true }
    });
    expect(storedUser?.emailVerificationTokens).toHaveLength(2);
  });

  it('rejects login before email verification', async () => {
    await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });

    const response = await postJson('/auth/login', {
      email: 'worker@example.com',
      password: 'Password123!'
    });

    expect(response.status).toBe(403);
  });

  it('verifies email and then logs in with valid credentials', async () => {
    const registered = await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });
    const registeredBody = await jsonBody<AuthUserResponse>(registered);

    const verifyResponse = await postJson('/auth/verify-email', {
      email: 'worker@example.com',
      code: registeredBody.devVerificationCode
    });
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.headers.get('set-cookie')).toContain('claimproof_session=');

    const response = await postJson('/auth/login', {
      email: 'worker@example.com',
      password: 'Password123!'
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<AuthUserResponse>(response);
    expect(body.user).toMatchObject({
      email: 'worker@example.com',
      status: 'ACTIVE'
    });
    expect(body.user.passwordHash).toBeUndefined();
    expect(response.headers.get('set-cookie')).toContain('claimproof_session=');
  });

  it('verifies email from the emailed token link', async () => {
    const registered = await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!'
    });
    const registeredBody = await jsonBody<AuthUserResponse>(registered);

    const response = await fetch(
      `${baseUrl}/auth/verify-email?token=${encodeURIComponent(registeredBody.devVerificationToken)}`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('set-cookie')).toContain('claimproof_session=');
    expect(await response.text()).toContain('Email verified');
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
    const cookie = await registerAndVerify('worker@example.com');

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
    const cookie = await registerAndVerify('worker@example.com');

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

  it('does not register test routes on the default app', async () => {
    const { app } = await import('../src/app.js');
    const defaultAppServer = createServer(app);
    await new Promise<void>((resolve) => {
      defaultAppServer.listen(0, '127.0.0.1', resolve);
    });
    const address = defaultAppServer.address() as AddressInfo;

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/test/protected`);

      expect(response.status).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) => {
        defaultAppServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
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

  async function registerAndVerify(email: string): Promise<string> {
    const registered = await postJson('/auth/register', {
      email,
      password: 'Password123!'
    });
    const body = await jsonBody<AuthUserResponse>(registered);
    const verified = await postJson('/auth/verify-email', {
      email,
      code: body.devVerificationCode
    });
    expect(verified.status).toBe(200);
    return sessionCookie(verified);
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
