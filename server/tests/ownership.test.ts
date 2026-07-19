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

interface CompanyResponse {
  company: {
    id: string;
    userId: string;
    name: string;
  };
}

interface ProjectResponse {
  project: {
    id: string;
    userId: string;
    companyId: string | null;
    projectName: string;
  };
}

describe('business resource ownership', () => {
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

  it('keeps profile ownership on the authenticated user when userId is spoofed', async () => {
    const userA = await registerUser('worker-a@example.com');
    const userB = await registerUser('worker-b@example.com');

    const response = await putJson(
      '/profile',
      {
        userId: userB.id,
        fullName: 'Worker A',
        phone: '+65 9000 0001',
        workerIdentifier: 'WA-001',
        finNric: 'S1234567A',
        trade: 'Electrical',
        employmentType: 'HOURLY',
        defaultHourlyRate: 28.5,
        defaultDailyRate: null,
        defaultMonthlySalary: null
      },
      userA.cookie
    );

    expect(response.status).toBe(200);
    const storedProfile = await prisma.workerProfile.findUnique({
      where: { userId: userA.id }
    });
    expect(storedProfile?.fullName).toBe('Worker A');
    expect(storedProfile?.userId).toBe(userA.id);
    await expect(prisma.workerProfile.findUnique({ where: { userId: userB.id } })).resolves.toBeNull();

    const getResponse = await fetch(`${baseUrl}/profile`, {
      headers: { Cookie: userA.cookie }
    });
    expect(getResponse.status).toBe(200);
  });

  it('prevents another user from reading updating or deleting a company', async () => {
    const userA = await registerUser('company-a@example.com');
    const userB = await registerUser('company-b@example.com');
    const createResponse = await postJson('/companies', companyPayload({ userId: userB.id }), userA.cookie);
    const created = await jsonBody<CompanyResponse>(createResponse);

    expect(createResponse.status).toBe(201);
    expect(created.company.userId).toBe(userA.id);

    const readResponse = await fetch(`${baseUrl}/companies/${created.company.id}`, {
      headers: { Cookie: userB.cookie }
    });
    expect(readResponse.status).toBe(404);

    const updateResponse = await putJson(
      `/companies/${created.company.id}`,
      { ...companyPayload(), name: 'Stolen Name' },
      userB.cookie
    );
    expect(updateResponse.status).toBe(404);

    const deleteResponse = await fetch(`${baseUrl}/companies/${created.company.id}`, {
      method: 'DELETE',
      headers: { Cookie: userB.cookie }
    });
    expect(deleteResponse.status).toBe(404);

    const storedCompany = await prisma.company.findUnique({ where: { id: created.company.id } });
    expect(storedCompany?.name).toBe('Acme Builders');
  });

  it('prevents another user from reading updating or deleting a project', async () => {
    const userA = await registerUser('project-a@example.com');
    const userB = await registerUser('project-b@example.com');
    const companyResponse = await postJson('/companies', companyPayload(), userA.cookie);
    const company = await jsonBody<CompanyResponse>(companyResponse);
    const projectResponse = await postJson(
      '/projects',
      projectPayload({ companyId: company.company.id, userId: userB.id }),
      userA.cookie
    );
    const created = await jsonBody<ProjectResponse>(projectResponse);

    expect(projectResponse.status).toBe(201);
    expect(created.project.userId).toBe(userA.id);
    expect(created.project.companyId).toBe(company.company.id);

    const readResponse = await fetch(`${baseUrl}/projects/${created.project.id}`, {
      headers: { Cookie: userB.cookie }
    });
    expect(readResponse.status).toBe(404);

    const updateResponse = await putJson(
      `/projects/${created.project.id}`,
      { ...projectPayload(), projectName: 'Wrong Owner Update' },
      userB.cookie
    );
    expect(updateResponse.status).toBe(404);

    const deleteResponse = await fetch(`${baseUrl}/projects/${created.project.id}`, {
      method: 'DELETE',
      headers: { Cookie: userB.cookie }
    });
    expect(deleteResponse.status).toBe(404);

    const storedProject = await prisma.project.findUnique({ where: { id: created.project.id } });
    expect(storedProject?.projectName).toBe('Mall Fitout');
  });

  it('rejects a project linked to another user company', async () => {
    const userA = await registerUser('link-a@example.com');
    const userB = await registerUser('link-b@example.com');
    const companyResponse = await postJson('/companies', companyPayload(), userA.cookie);
    const company = await jsonBody<CompanyResponse>(companyResponse);

    const response = await postJson('/projects', projectPayload({ companyId: company.company.id }), userB.cookie);

    expect(response.status).toBe(403);
    await expect(prisma.project.count({ where: { userId: userB.id } })).resolves.toBe(0);
  });

  it('rejects malformed money values on profile and project payloads', async () => {
    const user = await registerUser('money-validation@example.com');

    const profileResponse = await putJson(
      '/profile',
      {
        fullName: 'Worker A',
        phone: '+65 9000 0001',
        workerIdentifier: 'WA-001',
        finNric: 'S1234567A',
        trade: 'Electrical',
        employmentType: 'HOURLY',
        defaultHourlyRate: 'abc',
        defaultDailyRate: null,
        defaultMonthlySalary: null
      },
      user.cookie
    );
    expect(profileResponse.status).toBe(400);

    const projectResponse = await postJson(
      '/projects',
      projectPayload({
        defaultHourlyRate: '12.345'
      }),
      user.cookie
    );
    expect(projectResponse.status).toBe(400);
  });

  it('rejects invalid calendar dates and an endDate before startDate', async () => {
    const user = await registerUser('date-validation@example.com');

    const impossibleDateResponse = await postJson('/projects', projectPayload({ startDate: '2026-02-31' }), user.cookie);
    expect(impossibleDateResponse.status).toBe(400);

    const invalidDateResponse = await postJson('/projects', projectPayload({ startDate: '2026-13-40' }), user.cookie);
    expect(invalidDateResponse.status).toBe(400);

    const reversedRangeResponse = await postJson(
      '/projects',
      projectPayload({ startDate: '2026-06-10', endDate: '2026-06-09' }),
      user.cookie
    );
    expect(reversedRangeResponse.status).toBe(400);
  });

  it('returns 409 when deleting a company that still has projects', async () => {
    const user = await registerUser('company-conflict@example.com');
    const companyResponse = await postJson('/companies', companyPayload(), user.cookie);
    const company = await jsonBody<CompanyResponse>(companyResponse);
    await postJson('/projects', projectPayload({ companyId: company.company.id }), user.cookie);

    const deleteResponse = await fetch(`${baseUrl}/companies/${company.company.id}`, {
      method: 'DELETE',
      headers: { Cookie: user.cookie }
    });

    expect(deleteResponse.status).toBe(409);
  });

  it('returns 409 when deleting a project that has dependent records', async () => {
    const user = await registerUser('project-conflict@example.com');
    const projectResponse = await postJson('/projects', projectPayload(), user.cookie);
    const project = await jsonBody<ProjectResponse>(projectResponse);
    await prisma.timeEntry.create({
      data: {
        userId: user.id,
        projectId: project.project.id,
        date: new Date('2026-06-01T00:00:00.000Z'),
        clockInTime: new Date('2026-06-01T09:00:00.000Z'),
        clockOutTime: new Date('2026-06-01T17:00:00.000Z'),
        breakMinutes: 60,
        totalHours: 7,
        overtimeHours: 0,
        workDescription: 'Cable routing',
        manualEntryFlag: true,
        locationText: 'Site A',
        notes: ''
      }
    });

    const deleteResponse = await fetch(`${baseUrl}/projects/${project.project.id}`, {
      method: 'DELETE',
      headers: { Cookie: user.cookie }
    });

    expect(deleteResponse.status).toBe(409);
  });

  it('filters company and project lists to the authenticated user', async () => {
    const userA = await registerUser('list-a@example.com');
    const userB = await registerUser('list-b@example.com');
    const companyAResponse = await postJson('/companies', companyPayload({ name: 'A Builders' }), userA.cookie);
    const companyA = await jsonBody<CompanyResponse>(companyAResponse);
    await postJson('/companies', companyPayload({ name: 'B Builders' }), userB.cookie);
    await postJson('/projects', projectPayload({ companyId: companyA.company.id, projectName: 'A Project' }), userA.cookie);
    await postJson('/projects', projectPayload({ projectName: 'B Project' }), userB.cookie);

    const companiesResponse = await fetch(`${baseUrl}/companies`, { headers: { Cookie: userA.cookie } });
    const projectsResponse = await fetch(`${baseUrl}/projects`, { headers: { Cookie: userA.cookie } });
    const companies = (await companiesResponse.json()) as { companies: Array<{ userId: string; name: string }> };
    const projects = (await projectsResponse.json()) as { projects: Array<{ userId: string; projectName: string }> };

    expect(companies.companies).toHaveLength(1);
    expect(companies.companies[0]).toMatchObject({ userId: userA.id, name: 'A Builders' });
    expect(projects.projects).toHaveLength(1);
    expect(projects.projects[0]).toMatchObject({ userId: userA.id, projectName: 'A Project' });
  });

  it('rejects updating a project to another user company', async () => {
    const userA = await registerUser('project-update-a@example.com');
    const userB = await registerUser('project-update-b@example.com');
    const projectResponse = await postJson('/projects', projectPayload(), userA.cookie);
    const project = await jsonBody<ProjectResponse>(projectResponse);
    const companyResponse = await postJson('/companies', companyPayload(), userB.cookie);
    const company = await jsonBody<CompanyResponse>(companyResponse);

    const updateResponse = await putJson(`/projects/${project.project.id}`, { companyId: company.company.id }, userA.cookie);

    expect(updateResponse.status).toBe(403);
    const storedProject = await prisma.project.findUnique({ where: { id: project.project.id } });
    expect(storedProject?.companyId).toBeNull();
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

function companyPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Acme Builders',
    uen: '202600001A',
    contactPerson: 'Tan Mei',
    email: 'ops@acme.example',
    phone: '+65 6000 0000',
    address: '1 Jurong Road',
    notes: 'Main client for fitout claims',
    ...overrides
  };
}

function projectPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    companyId: null,
    projectName: 'Mall Fitout',
    siteAddress: '2 Orchard Road',
    poOrWorkOrderNumber: 'PO-1001',
    startDate: '2026-06-01',
    endDate: null,
    description: 'Electrical and finishing work',
    defaultHourlyRate: 28.5,
    defaultDailyRate: null,
    status: 'ACTIVE',
    ...overrides
  };
}

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  expect(setCookie).toBeTruthy();
  return setCookie?.split(';')[0] ?? '';
}

async function jsonBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
