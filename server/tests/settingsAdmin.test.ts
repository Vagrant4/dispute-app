import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

interface AuthUserResponse {
  devVerificationCode: string;
  verificationRequired?: boolean;
  message?: string;
  user: {
    id: string;
    email: string;
  };
}

interface SettingsResponse {
  settings: {
    id: string;
    userId: string;
    standardDailyHours: number;
    standardWeeklyHours: number;
    overtimeMultiplier: number;
    defaultCurrency: string;
  };
}

describe('settings and admin APIs', () => {
  let server: Server;
  let baseUrl: string;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const db = await import('../src/db/prisma.js');
    prisma = db.prisma;
    const { createApp } = await import('../src/app.js');
    server = createServer(createApp());
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

  it('creates default settings on GET when missing', async () => {
    const user = await registerUser('settings-defaults@example.com');
    await prisma.appSetting.deleteMany({ where: { userId: user.id } });

    const response = await fetch(`${baseUrl}/settings`, {
      headers: { Cookie: user.cookie }
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<SettingsResponse>(response);
    expect(body.settings).toMatchObject({
      userId: user.id,
      standardDailyHours: 8,
      standardWeeklyHours: 44,
      overtimeMultiplier: 1.5,
      defaultCurrency: 'SGD'
    });
    await expect(prisma.appSetting.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it('updates only the current user settings', async () => {
    const userA = await registerUser('settings-a@example.com');
    const userB = await registerUser('settings-b@example.com');

    const response = await putJson(
      '/settings',
      {
        standardDailyHours: 7.5,
        standardWeeklyHours: 40,
        overtimeMultiplier: 2,
        defaultCurrency: 'usd'
      },
      userA.cookie
    );

    expect(response.status).toBe(200);
    const body = await jsonBody<SettingsResponse>(response);
    expect(body.settings).toMatchObject({
      userId: userA.id,
      standardDailyHours: 7.5,
      standardWeeklyHours: 40,
      overtimeMultiplier: 2,
      defaultCurrency: 'USD'
    });

    const userBSettings = await prisma.appSetting.findUniqueOrThrow({ where: { userId: userB.id } });
    expect(userBSettings.standardDailyHours).toBe(8);
    expect(userBSettings.defaultCurrency).toBe('SGD');
  });

  it('rejects invalid settings values', async () => {
    const user = await registerUser('settings-invalid@example.com');

    const invalidHours = await putJson(
      '/settings',
      {
        standardDailyHours: 0,
        standardWeeklyHours: 44,
        overtimeMultiplier: 1.5,
        defaultCurrency: 'SGD'
      },
      user.cookie
    );
    expect(invalidHours.status).toBe(400);

    const invalidCurrency = await putJson(
      '/settings',
      {
        standardDailyHours: 8,
        standardWeeklyHours: 44,
        overtimeMultiplier: 1.5,
        defaultCurrency: 'SING'
      },
      user.cookie
    );
    expect(invalidCurrency.status).toBe(400);
  });

  it('rejects daily hours outside realistic bounds', async () => {
    const user = await registerUser('settings-daily-bounds@example.com');

    const tooLow = await putJson(
      '/settings',
      {
        standardDailyHours: 0.5,
        standardWeeklyHours: 44,
        overtimeMultiplier: 1.5,
        defaultCurrency: 'SGD'
      },
      user.cookie
    );
    expect(tooLow.status).toBe(400);

    const tooHigh = await putJson(
      '/settings',
      {
        standardDailyHours: 25,
        standardWeeklyHours: 44,
        overtimeMultiplier: 1.5,
        defaultCurrency: 'SGD'
      },
      user.cookie
    );
    expect(tooHigh.status).toBe(400);
  });

  it('rejects weekly hours outside realistic bounds', async () => {
    const user = await registerUser('settings-weekly-bounds@example.com');

    const response = await putJson(
      '/settings',
      {
        standardDailyHours: 8,
        standardWeeklyHours: 169,
        overtimeMultiplier: 1.5,
        defaultCurrency: 'SGD'
      },
      user.cookie
    );

    expect(response.status).toBe(400);
  });

  it('rejects weekly hours lower than daily hours', async () => {
    const user = await registerUser('settings-weekly-under-daily@example.com');

    const response = await putJson(
      '/settings',
      {
        standardDailyHours: 8,
        standardWeeklyHours: 7,
        overtimeMultiplier: 1.5,
        defaultCurrency: 'SGD'
      },
      user.cookie
    );

    expect(response.status).toBe(400);
  });

  it('rejects overtime multipliers outside realistic bounds', async () => {
    const user = await registerUser('settings-overtime-bounds@example.com');

    const tooLow = await putJson(
      '/settings',
      {
        standardDailyHours: 8,
        standardWeeklyHours: 44,
        overtimeMultiplier: 0.5,
        defaultCurrency: 'SGD'
      },
      user.cookie
    );
    expect(tooLow.status).toBe(400);

    const tooHigh = await putJson(
      '/settings',
      {
        standardDailyHours: 8,
        standardWeeklyHours: 44,
        overtimeMultiplier: 6,
        defaultCurrency: 'SGD'
      },
      user.cookie
    );
    expect(tooHigh.status).toBe(400);
  });

  it('accepts normal settings values used in calculations', async () => {
    const user = await registerUser('settings-normal-bounds@example.com');

    const response = await putJson(
      '/settings',
      {
        standardDailyHours: 8,
        standardWeeklyHours: 44,
        overtimeMultiplier: 1.5,
        defaultCurrency: 'sgd'
      },
      user.cookie
    );

    expect(response.status).toBe(200);
    const body = await jsonBody<SettingsResponse>(response);
    expect(body.settings).toMatchObject({
      userId: user.id,
      standardDailyHours: 8,
      standardWeeklyHours: 44,
      overtimeMultiplier: 1.5,
      defaultCurrency: 'SGD'
    });
  });

  it('does not let another user affect the first user settings', async () => {
    const userA = await registerUser('settings-owner-a@example.com');
    const userB = await registerUser('settings-owner-b@example.com');

    await putJson(
      '/settings',
      {
        standardDailyHours: 6,
        standardWeeklyHours: 30,
        overtimeMultiplier: 1.25,
        defaultCurrency: 'MYR'
      },
      userB.cookie
    );

    const response = await fetch(`${baseUrl}/settings`, {
      headers: { Cookie: userA.cookie }
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<SettingsResponse>(response);
    expect(body.settings).toMatchObject({
      userId: userA.id,
      standardDailyHours: 8,
      standardWeeklyHours: 44,
      overtimeMultiplier: 1.5,
      defaultCurrency: 'SGD'
    });
  });

  it('returns a harmless admin placeholder without management data', async () => {
    const user = await registerUser('admin-placeholder@example.com');

    const response = await fetch(`${baseUrl}/admin`, {
      headers: { Cookie: user.cookie }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      message: 'Admin features are reserved for future ClaimProof SG versions.'
    });
    expect(JSON.stringify(body).toLowerCase()).not.toContain('user');
    expect(JSON.stringify(body).toLowerCase()).not.toContain('management');
  });

  async function registerUser(email: string): Promise<{ id: string; cookie: string }> {
    const response = await postJson('/auth/register', {
      email,
      password: 'Password123!'
    });
    expect(response.status).toBe(201);
    const body = await jsonBody<AuthUserResponse>(response);
    return {
      id: body.user.id,
      cookie: await verifiedCookie(email, body.devVerificationCode)
    };
  }
  async function verifiedCookie(email: string, code: string): Promise<string> {
    expect(code).toMatch(/^\d{6}$/);
    const response = await postJson('/auth/verify-email', { email, code });
    expect(response.status).toBe(200);
    return sessionCookie(response);
  }

  function postJson(path: string, body: unknown, cookie?: string): Promise<Response> {
    return requestJson('POST', path, body, cookie);
  }

  function putJson(path: string, body: unknown, cookie?: string): Promise<Response> {
    return requestJson('PUT', path, body, cookie);
  }

  function requestJson(method: string, path: string, body: unknown, cookie?: string): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method,
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
