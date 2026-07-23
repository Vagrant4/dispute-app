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
  devResetCode?: string;
  verificationRequired?: boolean;
  resetRequired?: boolean;
  message?: string;
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
    passwordHash?: string;
  };
  profile?: {
    fullName: string;
    phone: string;
  } | null;
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
      prisma.passwordResetToken.deleteMany(),
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
      password: 'Password123!',
      fullName: 'Local Worker',
      phone: '+65 9000 0000'
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
      include: { appSetting: true, emailVerificationTokens: true, profile: true }
    });
    expect(storedUser?.passwordHash).not.toBe('Password123!');
    expect(storedUser?.emailVerifiedAt).toBeNull();
    expect(storedUser?.appSetting?.defaultCurrency).toBe('SGD');
    expect(storedUser?.emailVerificationTokens).toHaveLength(1);
    expect(storedUser?.profile).toMatchObject({
      fullName: 'Local Worker',
      phone: '+65 9000 0000',
      trade: 'Not specified',
      employmentType: 'FREELANCER'
    });
  });

  it('requires full name and mobile number during registration', async () => {
    const missingProfile = await postJson('/auth/register', {
      email: 'missing-profile@example.com',
      password: 'Password123!'
    });
    expect(missingProfile.status).toBe(400);

    const missingPhone = await postJson('/auth/register', {
      email: 'missing-phone@example.com',
      password: 'Password123!',
      fullName: 'Missing Phone'
    });
    expect(missingPhone.status).toBe(400);
  });

  it('resends verification code without re-registering or changing the password', async () => {
    const registered = await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!',
      fullName: 'Local Worker',
      phone: '+65 9000 0000'
    });
    const original = await jsonBody<AuthUserResponse>(registered);

    const response = await postJson('/auth/resend-verification', {
      email: 'worker@example.com'
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<AuthUserResponse>(response);
    expect(body.verificationRequired).toBe(true);
    expect(body.message).toContain('new verification code');

    const storedUser = await prisma.user.findUnique({
      where: { email: 'worker@example.com' },
      include: { emailVerificationTokens: true }
    });
    expect(storedUser?.emailVerificationTokens).toHaveLength(2);
    expect(storedUser?.emailVerificationTokens.filter((token) => !token.consumedAt)).toHaveLength(1);

    expect(
      (await postJson('/auth/verify-email', { email: 'worker@example.com', code: original.devVerificationCode })).status
    ).toBe(400);
    expect(
      (await postJson('/auth/verify-email', { email: 'worker@example.com', code: body.devVerificationCode })).status
    ).toBe(200);
  });

  it('rejects an expired email verification code', async () => {
    const registered = await postJson('/auth/register', {
      email: 'expired@example.com',
      password: 'Password123!',
      fullName: 'Expired Worker',
      phone: '+65 9000 0001'
    });
    const body = await jsonBody<AuthUserResponse>(registered);
    await prisma.emailVerificationToken.updateMany({
      where: { user: { email: 'expired@example.com' } },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    const response = await postJson('/auth/verify-email', {
      email: 'expired@example.com',
      code: body.devVerificationCode
    });
    expect(response.status).toBe(400);
  });

  it('does not let duplicate pending registration replace the password', async () => {
    const registered = await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!',
      fullName: 'Local Worker',
      phone: '+65 9000 0000'
    });
    const registeredBody = await jsonBody<AuthUserResponse>(registered);

    const duplicate = await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'AttackerPassword123!',
      fullName: 'Attacker',
      phone: '+65 9000 0999'
    });
    expect(duplicate.status).toBe(409);

    const verified = await postJson('/auth/verify-email', {
      email: 'worker@example.com',
      code: registeredBody.devVerificationCode
    });
    expect(verified.status).toBe(200);

    expect(
      (await postJson('/auth/login', { email: 'worker@example.com', password: 'Password123!' })).status
    ).toBe(200);
    expect(
      (await postJson('/auth/login', { email: 'worker@example.com', password: 'AttackerPassword123!' })).status
    ).toBe(401);
  });

  it('rejects login before email verification', async () => {
    await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!',
      fullName: 'Local Worker',
      phone: '+65 9000 0000'
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
      password: 'Password123!',
      fullName: 'Local Worker',
      phone: '+65 9000 0000'
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
    expect(body.profile).toMatchObject({
      fullName: 'Local Worker',
      phone: '+65 9000 0000'
    });
    expect(body.user.passwordHash).toBeUndefined();
    expect(response.headers.get('set-cookie')).toContain('claimproof_session=');
  });

  it('verifies email from the emailed token link', async () => {
    const registered = await postJson('/auth/register', {
      email: 'worker@example.com',
      password: 'Password123!',
      fullName: 'Local Worker',
      phone: '+65 9000 0000'
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
      password: 'Password123!',
      fullName: 'Local Worker',
      phone: '+65 9000 0000'
    });

    const response = await postJson('/auth/login', {
      email: 'worker@example.com',
      password: 'wrong-password'
    });

    expect(response.status).toBe(401);
  });

  it('sends a reset code and resets password before login', async () => {
    const cookie = await registerAndVerify('reset@example.com');

    const logoutResponse = await postJson('/auth/logout', {}, cookie);
    expect(logoutResponse.status).toBe(204);

    const resetRequest = await postJson('/auth/forgot-password', {
      email: 'reset@example.com'
    });
    expect(resetRequest.status).toBe(200);
    const resetBody = await jsonBody<AuthUserResponse>(resetRequest);
    expect(resetBody.resetRequired).toBe(true);
    expect(resetBody.devResetCode).toMatch(/^\d{6}$/);

    const resetResponse = await postJson('/auth/reset-password', {
      email: 'reset@example.com',
      code: resetBody.devResetCode,
      password: 'NewPassword123!'
    });
    expect(resetResponse.status).toBe(200);

    const oldPasswordResponse = await postJson('/auth/login', {
      email: 'reset@example.com',
      password: 'Password123!'
    });
    expect(oldPasswordResponse.status).toBe(401);

    const newPasswordResponse = await postJson('/auth/login', {
      email: 'reset@example.com',
      password: 'NewPassword123!'
    });
    expect(newPasswordResponse.status).toBe(200);
  });

  it('invalidates older password reset codes when a new code is requested', async () => {
    await registerAndVerify('reset-latest@example.com');
    const first = await jsonBody<AuthUserResponse>(
      await postJson('/auth/forgot-password', { email: 'reset-latest@example.com' })
    );
    const second = await jsonBody<AuthUserResponse>(
      await postJson('/auth/forgot-password', { email: 'reset-latest@example.com' })
    );

    expect(
      (
        await postJson('/auth/reset-password', {
          email: 'reset-latest@example.com',
          code: first.devResetCode,
          password: 'NewPassword123!'
        })
      ).status
    ).toBe(400);
    expect(
      (
        await postJson('/auth/reset-password', {
          email: 'reset-latest@example.com',
          code: second.devResetCode,
          password: 'NewPassword123!'
        })
      ).status
    ).toBe(200);
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
      password: 'Password123!',
      fullName: 'Test Worker',
      phone: '+65 9000 0000'
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
