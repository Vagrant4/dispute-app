import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

interface AuthUserResponse {
  user: {
    id: string;
    email: string;
  };
}

interface CompanyResponse {
  company: {
    id: string;
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

interface PaySummaryResponse {
  paySummary: {
    id: string;
    userId: string;
    projectId: string | null;
    salaryPeriodStart: string;
    salaryPeriodEnd: string;
    rateType: string;
    basicRate: string;
    basicPay: string;
    overtimeRate: string;
    overtimePay: string;
    restDayPay: string;
    publicHolidayPay: string;
    totalAllowances: string;
    totalDeductions: string;
    grossPay: string;
    netPay: string;
    itemisedPayslipJson: string;
    notes: string;
    allowances: Array<{ description: string; amount: string }>;
    deductions: Array<{ description: string; amount: string }>;
  };
}

interface PaySummariesResponse {
  paySummaries: PaySummaryResponse['paySummary'][];
}

describe('pay summary API', () => {
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

  it('generates a project pay summary from finalized entries with line items and itemised JSON', async () => {
    const user = await registerUser('pay-generate@example.com');
    await updateProfile(user.cookie, 'Tan Worker');
    await prisma.appSetting.update({
      where: { userId: user.id },
      data: { overtimeMultiplier: 1.5 }
    });
    const company = await createCompany(user.cookie, 'ABC Construction Pte Ltd');
    const project = await createProject(user.cookie, company.id);
    await createTimeEntry(user.id, project.id, {
      date: new Date('2026-06-01T00:00:00.000Z'),
      totalHours: 10,
      overtimeHours: 2,
      status: 'FINALIZED'
    });
    await createTimeEntry(user.id, project.id, {
      date: new Date('2026-06-02T00:00:00.000Z'),
      totalHours: 7,
      overtimeHours: 0,
      status: 'FINALIZED'
    });
    await createTimeEntry(user.id, project.id, {
      date: new Date('2026-06-03T00:00:00.000Z'),
      totalHours: 8,
      overtimeHours: 0,
      status: 'DRAFT'
    });

    const response = await postJson('/pay-summaries/generate', {
      projectId: project.id,
      salaryPeriodStart: '2026-06-01',
      salaryPeriodEnd: '2026-06-30',
      rateType: 'HOURLY',
      basicRate: 30,
      restDayPay: 5,
      publicHolidayPay: 7,
      allowances: [
        { description: 'Transport', amount: 25 },
        { description: 'Meal', amount: 10 }
      ],
      deductions: [{ description: 'Advance', amount: 15 }],
      notes: 'June claim'
    }, user.cookie);

    expect(response.status).toBe(201);
    const body = await jsonBody<PaySummaryResponse>(response);
    expect(body.paySummary).toMatchObject({
      userId: user.id,
      projectId: project.id,
      rateType: 'HOURLY',
      notes: 'June claim'
    });
    expectMoney(body.paySummary.basicRate, 30);
    expectMoney(body.paySummary.overtimeRate, 45);
    expectMoney(body.paySummary.basicPay, 450);
    expectMoney(body.paySummary.overtimePay, 90);
    expectMoney(body.paySummary.restDayPay, 5);
    expectMoney(body.paySummary.publicHolidayPay, 7);
    expectMoney(body.paySummary.totalAllowances, 35);
    expectMoney(body.paySummary.totalDeductions, 15);
    expectMoney(body.paySummary.grossPay, 587);
    expectMoney(body.paySummary.netPay, 572);
    expect(body.paySummary.allowances).toHaveLength(2);
    expect(body.paySummary.deductions).toHaveLength(1);

    const itemised = JSON.parse(body.paySummary.itemisedPayslipJson) as Record<string, unknown>;
    expect(itemised).toMatchObject({
      workerName: 'Tan Worker',
      clientCompanyName: 'ABC Construction Pte Ltd',
      salaryPeriodStart: '2026-06-01',
      salaryPeriodEnd: '2026-06-30',
      basicPay: 450,
      overtimeHours: 2,
      overtimePay: 90,
      grossPay: 587,
      netPay: 572,
      notes: 'June claim'
    });
    expect(itemised.allowances).toEqual([
      { description: 'Transport', amount: 25 },
      { description: 'Meal', amount: 10 }
    ]);
    expect(itemised.deductions).toEqual([{ description: 'Advance', amount: 15 }]);
  });

  it('uses an explicit overtime rate when provided', async () => {
    const user = await registerUser('pay-explicit-ot@example.com');
    const project = await createProject(user.cookie);
    await createTimeEntry(user.id, project.id, {
      date: new Date('2026-06-01T00:00:00.000Z'),
      totalHours: 9,
      overtimeHours: 1,
      status: 'FINALIZED'
    });

    const response = await postJson('/pay-summaries/generate', {
      projectId: project.id,
      salaryPeriodStart: '2026-06-01',
      salaryPeriodEnd: '2026-06-30',
      rateType: 'HOURLY',
      basicRate: 20,
      overtimeRate: 50
    }, user.cookie);

    expect(response.status).toBe(201);
    const body = await jsonBody<PaySummaryResponse>(response);
    expectMoney(body.paySummary.basicPay, 160);
    expectMoney(body.paySummary.overtimeRate, 50);
    expectMoney(body.paySummary.overtimePay, 50);
  });

  it('lists and reads only owned pay summaries', async () => {
    const userA = await registerUser('pay-list-a@example.com');
    const userB = await registerUser('pay-list-b@example.com');
    const projectA = await createProject(userA.cookie);
    const projectB = await createProject(userB.cookie);
    await createTimeEntry(userA.id, projectA.id, {
      date: new Date('2026-06-01T00:00:00.000Z'),
      totalHours: 8,
      overtimeHours: 0,
      status: 'FINALIZED'
    });
    await createTimeEntry(userB.id, projectB.id, {
      date: new Date('2026-06-01T00:00:00.000Z'),
      totalHours: 8,
      overtimeHours: 0,
      status: 'FINALIZED'
    });
    const summaryAResponse = await generateBasicSummary(userA.cookie, projectA.id);
    const summaryA = await jsonBody<PaySummaryResponse>(summaryAResponse);
    await generateBasicSummary(userB.cookie, projectB.id);

    const listResponse = await fetch(`${baseUrl}/pay-summaries`, {
      headers: { Cookie: userA.cookie }
    });
    const readResponse = await fetch(`${baseUrl}/pay-summaries/${summaryA.paySummary.id}`, {
      headers: { Cookie: userA.cookie }
    });

    expect(listResponse.status).toBe(200);
    const listBody = await jsonBody<PaySummariesResponse>(listResponse);
    expect(listBody.paySummaries).toHaveLength(1);
    expect(listBody.paySummaries[0].id).toBe(summaryA.paySummary.id);
    expect(readResponse.status).toBe(200);
  });

  it('denies another user project when generating and another user summary when reading or deleting', async () => {
    const owner = await registerUser('pay-owner@example.com');
    const other = await registerUser('pay-other@example.com');
    const ownerProject = await createProject(owner.cookie);
    await createTimeEntry(owner.id, ownerProject.id, {
      date: new Date('2026-06-01T00:00:00.000Z'),
      totalHours: 8,
      overtimeHours: 0,
      status: 'FINALIZED'
    });
    const summaryResponse = await generateBasicSummary(owner.cookie, ownerProject.id);
    const summary = await jsonBody<PaySummaryResponse>(summaryResponse);

    const generateResponse = await postJson('/pay-summaries/generate', {
      projectId: ownerProject.id,
      salaryPeriodStart: '2026-06-01',
      salaryPeriodEnd: '2026-06-30',
      rateType: 'HOURLY',
      basicRate: 20
    }, other.cookie);
    const readResponse = await fetch(`${baseUrl}/pay-summaries/${summary.paySummary.id}`, {
      headers: { Cookie: other.cookie }
    });
    const deleteResponse = await fetch(`${baseUrl}/pay-summaries/${summary.paySummary.id}`, {
      method: 'DELETE',
      headers: { Cookie: other.cookie }
    });
    const ownerReadResponse = await fetch(`${baseUrl}/pay-summaries/${summary.paySummary.id}`, {
      headers: { Cookie: owner.cookie }
    });

    expect(generateResponse.status).toBe(403);
    expect(readResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
    expect(ownerReadResponse.status).toBe(200);
  });

  it('deletes an owned pay summary with line items', async () => {
    const user = await registerUser('pay-delete@example.com');
    const project = await createProject(user.cookie);
    await createTimeEntry(user.id, project.id, {
      date: new Date('2026-06-01T00:00:00.000Z'),
      totalHours: 8,
      overtimeHours: 0,
      status: 'FINALIZED'
    });
    const summaryResponse = await postJson('/pay-summaries/generate', {
      projectId: project.id,
      salaryPeriodStart: '2026-06-01',
      salaryPeriodEnd: '2026-06-30',
      rateType: 'HOURLY',
      basicRate: 20,
      allowances: [{ description: 'Transport', amount: 10 }],
      deductions: [{ description: 'Advance', amount: 5 }]
    }, user.cookie);
    const summary = await jsonBody<PaySummaryResponse>(summaryResponse);

    const response = await fetch(`${baseUrl}/pay-summaries/${summary.paySummary.id}`, {
      method: 'DELETE',
      headers: { Cookie: user.cookie }
    });
    const readAfterDelete = await fetch(`${baseUrl}/pay-summaries/${summary.paySummary.id}`, {
      headers: { Cookie: user.cookie }
    });
    const allowanceCount = await prisma.allowance.count({ where: { paySummaryId: summary.paySummary.id } });
    const deductionCount = await prisma.deduction.count({ where: { paySummaryId: summary.paySummary.id } });

    expect(response.status).toBe(204);
    expect(readAfterDelete.status).toBe(404);
    expect(allowanceCount).toBe(0);
    expect(deductionCount).toBe(0);
  });

  it('rejects invalid dates and money inputs', async () => {
    const user = await registerUser('pay-validation@example.com');
    const project = await createProject(user.cookie);

    const endBeforeStart = await postJson('/pay-summaries/generate', {
      projectId: project.id,
      salaryPeriodStart: '2026-06-30',
      salaryPeriodEnd: '2026-06-01',
      rateType: 'HOURLY',
      basicRate: 20
    }, user.cookie);
    const invalidDate = await postJson('/pay-summaries/generate', {
      projectId: project.id,
      salaryPeriodStart: '2026-02-30',
      salaryPeriodEnd: '2026-06-30',
      rateType: 'HOURLY',
      basicRate: 20
    }, user.cookie);
    const negativeMoney = await postJson('/pay-summaries/generate', {
      projectId: project.id,
      salaryPeriodStart: '2026-06-01',
      salaryPeriodEnd: '2026-06-30',
      rateType: 'HOURLY',
      basicRate: -1
    }, user.cookie);
    const invalidLineItem = await postJson('/pay-summaries/generate', {
      projectId: project.id,
      salaryPeriodStart: '2026-06-01',
      salaryPeriodEnd: '2026-06-30',
      rateType: 'HOURLY',
      basicRate: 20,
      allowances: [{ description: 'Transport', amount: -5 }]
    }, user.cookie);

    expect(endBeforeStart.status).toBe(400);
    expect(invalidDate.status).toBe(400);
    expect(negativeMoney.status).toBe(400);
    expect(invalidLineItem.status).toBe(400);
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
      cookie: sessionCookie(response)
    };
  }

  function updateProfile(cookie: string, fullName: string): Promise<Response> {
    return requestJson('PUT', '/profile', {
      fullName,
      phone: '91234567',
      workerIdentifier: null,
      finNric: null,
      trade: 'Installer',
      employmentType: 'HOURLY',
      defaultHourlyRate: 30,
      defaultDailyRate: null,
      defaultMonthlySalary: null
    }, cookie);
  }

  async function createCompany(cookie: string, name: string): Promise<CompanyResponse['company']> {
    const response = await postJson('/companies', {
      name,
      uen: null,
      contactPerson: 'Site Manager',
      email: 'site@example.com',
      phone: '61234567',
      address: '2 Orchard Road',
      notes: ''
    }, cookie);
    expect(response.status).toBe(201);
    const body = await jsonBody<CompanyResponse>(response);
    return body.company;
  }

  async function createProject(cookie: string, companyId: string | null = null): Promise<ProjectResponse['project']> {
    const response = await postJson('/projects', {
      companyId,
      projectName: 'Steel Bracket Installation',
      siteAddress: '2 Orchard Road',
      poOrWorkOrderNumber: 'PO-1001',
      startDate: '2026-06-01',
      endDate: null,
      description: 'Installation work',
      defaultHourlyRate: 28.5,
      defaultDailyRate: null,
      status: 'ACTIVE'
    }, cookie);
    expect(response.status).toBe(201);
    const body = await jsonBody<ProjectResponse>(response);
    return body.project;
  }

  function createTimeEntry(
    userId: string,
    projectId: string,
    input: { date: Date; totalHours: number; overtimeHours: number; status: 'DRAFT' | 'FINALIZED' }
  ) {
    return prisma.timeEntry.create({
      data: {
        userId,
        projectId,
        date: input.date,
        clockInTime: input.date,
        clockOutTime: new Date(input.date.getTime() + input.totalHours * 60 * 60 * 1000),
        breakMinutes: 0,
        totalHours: input.totalHours,
        overtimeHours: input.overtimeHours,
        workDescription: 'Installed steel brackets',
        manualEntryFlag: true,
        locationText: 'Site A',
        status: input.status,
        notes: ''
      }
    });
  }

  function generateBasicSummary(cookie: string, projectId: string): Promise<Response> {
    return postJson('/pay-summaries/generate', {
      projectId,
      salaryPeriodStart: '2026-06-01',
      salaryPeriodEnd: '2026-06-30',
      rateType: 'HOURLY',
      basicRate: 20
    }, cookie);
  }

  function postJson(path: string, body: unknown, cookie?: string): Promise<Response> {
    return requestJson('POST', path, body, cookie);
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

function expectMoney(actual: string, expected: number): void {
  expect(Number(actual)).toBe(expected);
}

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  expect(setCookie).toBeTruthy();
  return setCookie?.split(';')[0] ?? '';
}

async function jsonBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
