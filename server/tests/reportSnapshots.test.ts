import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Prisma, type PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildProgressClaimSnapshot } from '../src/utils/reportSnapshots.js';

process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.EXPORT_ROOT = join(process.cwd(), '.test-exports', 'reports');

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

interface ReportResponse {
  report: {
    id: string;
    userId: string;
    projectId: string;
    companySnapshotJson: string;
    workerSnapshotJson: string;
    projectSnapshotJson: string;
    entriesSnapshotJson: string;
    photosSnapshotJson: string;
    totalDaysWorked: number;
    totalHours: number;
    totalOvertimeHours: number;
    totalClaimAmount: string;
    pdfPath: string;
    csvPath: string;
  };
}

interface ReportsResponse {
  reports: ReportResponse['report'][];
}

describe('progress claim report snapshots and exports', () => {
  let server: Server;
  let baseUrl: string;
  let prisma: PrismaClient;
  let exportRoot: string;

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
    exportRoot = process.env.EXPORT_ROOT!;
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
    await resetExportRoot(exportRoot);
  });

  afterAll(async () => {
    await resetExportRoot(exportRoot);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.$disconnect();
  });

  it('builds an immutable snapshot with worker company project entries photos and totals', () => {
    const source = {
      worker: {
        fullName: 'Tan Worker',
        phone: '91234567',
        workerIdentifier: 'W-1',
        finNric: null,
        trade: 'Installer',
        employmentType: 'HOURLY'
      },
      company: {
        name: 'ABC Construction Pte Ltd',
        uen: '202600001A',
        contactPerson: 'Site Manager',
        email: 'site@example.com',
        phone: '61234567',
        address: '2 Orchard Road',
        notes: 'Main client'
      },
      project: {
        id: 'project-1',
        projectName: 'Steel Bracket Installation',
        siteAddress: '2 Orchard Road',
        poOrWorkOrderNumber: 'PO-1001',
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: null,
        description: 'Install brackets',
        defaultHourlyRate: new Prisma.Decimal(30),
        defaultDailyRate: null,
        status: 'ACTIVE'
      },
      entries: [
        {
          id: 'entry-1',
          date: new Date('2026-06-01T00:00:00.000Z'),
          clockInTime: new Date('2026-06-01T09:00:00.000Z'),
          clockOutTime: new Date('2026-06-01T18:00:00.000Z'),
          breakMinutes: 60,
          totalHours: 8,
          overtimeHours: 0,
          workDescription: 'Installed frames',
          manualEntryFlag: true,
          locationText: 'Site A',
          notes: ''
        },
        {
          id: 'entry-2',
          date: new Date('2026-06-02T00:00:00.000Z'),
          clockInTime: new Date('2026-06-02T09:00:00.000Z'),
          clockOutTime: new Date('2026-06-02T19:00:00.000Z'),
          breakMinutes: 60,
          totalHours: 9,
          overtimeHours: 1,
          workDescription: 'Completed installation',
          manualEntryFlag: true,
          locationText: 'Site A',
          notes: 'Done'
        }
      ],
      photos: [
        {
          id: 'photo-1',
          timeEntryId: 'entry-1',
          imagePath: 'uploads/user/photo.jpg',
          caption: 'Before work',
          evidenceType: 'BEFORE_WORK',
          timestamp: new Date('2026-06-01T10:00:00.000Z'),
          gpsLat: 1.3,
          gpsLng: 103.8
        }
      ],
      totals: {
        totalDaysWorked: 2,
        totalHours: 17,
        totalOvertimeHours: 1,
        hourlyRate: 30,
        overtimeRate: 45,
        regularHours: 16,
        basicPay: 480,
        overtimePay: 45,
        allowances: 10,
        deductions: 5,
        restDayPay: 0,
        publicHolidayPay: 0,
        grossPay: 535,
        netPay: 530,
        totalClaimAmount: 530
      }
    };

    const snapshot = buildProgressClaimSnapshot(source);
    source.worker.fullName = 'Changed Worker';
    source.company.name = 'Changed Company';
    source.project.projectName = 'Changed Project';
    source.entries[0].workDescription = 'Changed work';
    source.photos[0].caption = 'Changed caption';
    source.totals.totalClaimAmount = 1;

    expect(snapshot.worker.fullName).toBe('Tan Worker');
    expect(snapshot.company?.name).toBe('ABC Construction Pte Ltd');
    expect(snapshot.project.projectName).toBe('Steel Bracket Installation');
    expect(snapshot.entries[0]).toMatchObject({
      date: '2026-06-01',
      workDescription: 'Installed frames',
      totalHours: 8
    });
    expect(snapshot.photos[0]).toMatchObject({
      imagePath: 'uploads/user/photo.jpg',
      fileName: 'photo.jpg',
      caption: 'Before work'
    });
    expect(snapshot.totals).toMatchObject({
      totalDaysWorked: 2,
      totalHours: 17,
      totalOvertimeHours: 1,
      totalClaimAmount: 530
    });
  });

  it('generates a report row with owned pdf and csv paths', async () => {
    const user = await registerUser('report-generate@example.com');
    await updateProfile(user.cookie);
    await prisma.appSetting.update({ where: { userId: user.id }, data: { overtimeMultiplier: 1.5 } });
    const company = await createCompany(user.cookie);
    const project = await createProject(user.cookie, company.id);
    await createTimeEntry(user.id, project.id, '2026-06-01', 8, 0, 'Installed brackets', 'FINALIZED');
    await createTimeEntry(user.id, project.id, '2026-06-02', 10, 2, 'Completed brackets', 'FINALIZED');
    await createTimeEntry(user.id, project.id, '2026-06-03', 8, 0, 'Draft work', 'DRAFT');
    await createPhoto(user.id, project.id, '2026-06-02T10:00:00.000Z', 'uploads/demo/completed.jpg');

    const response = await postJson('/reports/progress-claim', {
      projectId: project.id,
      claimPeriodStart: '2026-06-01',
      claimPeriodEnd: '2026-06-30',
      hourlyRate: 30,
      allowances: 20,
      deductions: 10,
      notes: 'June progress claim'
    }, user.cookie);

    expect(response.status).toBe(201);
    const body = await jsonBody<ReportResponse>(response);
    expect(body.report).toMatchObject({
      userId: user.id,
      projectId: project.id,
      totalDaysWorked: 2,
      totalHours: 18,
      totalOvertimeHours: 2
    });
    expect(Number(body.report.totalClaimAmount)).toBe(580);
    expect(body.report.pdfPath).toMatch(new RegExp(`^\\.test-exports/reports/${user.id}/`));
    expect(body.report.csvPath).toMatch(new RegExp(`^\\.test-exports/reports/${user.id}/`));
    expect(existsSync(join(process.cwd(), body.report.pdfPath))).toBe(true);
    expect(existsSync(join(process.cwd(), body.report.csvPath))).toBe(true);

    const entries = JSON.parse(body.report.entriesSnapshotJson) as unknown[];
    const photos = JSON.parse(body.report.photosSnapshotJson) as unknown[];
    expect(entries).toHaveLength(2);
    expect(photos).toHaveLength(1);
  });

  it('returns owned pdf and csv files and lists owned reports only', async () => {
    const owner = await registerUser('report-owner@example.com');
    const other = await registerUser('report-other@example.com');
    await updateProfile(owner.cookie);
    await updateProfile(other.cookie);
    const ownerProject = await createProject(owner.cookie);
    const otherProject = await createProject(other.cookie);
    await createTimeEntry(owner.id, ownerProject.id, '2026-06-01', 8, 0, 'Owner work', 'FINALIZED');
    await createTimeEntry(other.id, otherProject.id, '2026-06-01', 8, 0, 'Other work', 'FINALIZED');
    const ownerReportResponse = await generateBasicReport(owner.cookie, ownerProject.id);
    const ownerReport = await jsonBody<ReportResponse>(ownerReportResponse);
    await generateBasicReport(other.cookie, otherProject.id);

    const listResponse = await fetch(`${baseUrl}/reports`, { headers: { Cookie: owner.cookie } });
    const pdfResponse = await fetch(`${baseUrl}/reports/${ownerReport.report.id}/pdf`, { headers: { Cookie: owner.cookie } });
    const csvResponse = await fetch(`${baseUrl}/reports/${ownerReport.report.id}/csv`, { headers: { Cookie: owner.cookie } });

    expect(listResponse.status).toBe(200);
    const listBody = await jsonBody<ReportsResponse>(listResponse);
    expect(listBody.reports).toHaveLength(1);
    expect(listBody.reports[0].id).toBe(ownerReport.report.id);
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers.get('content-type')).toContain('application/pdf');
    expect(await pdfResponse.arrayBuffer()).toHaveProperty('byteLength', expect.any(Number));
    expect(csvResponse.status).toBe(200);
    expect(csvResponse.headers.get('content-type')).toContain('text/csv');
    expect(await csvResponse.text()).toContain('Owner work');
  });

  it('prevents another user from reading downloading or deleting a report', async () => {
    const owner = await registerUser('report-secure-owner@example.com');
    const other = await registerUser('report-secure-other@example.com');
    await updateProfile(owner.cookie);
    const project = await createProject(owner.cookie);
    await createTimeEntry(owner.id, project.id, '2026-06-01', 8, 0, 'Owner work', 'FINALIZED');
    const reportResponse = await generateBasicReport(owner.cookie, project.id);
    const report = await jsonBody<ReportResponse>(reportResponse);

    const readResponse = await fetch(`${baseUrl}/reports/${report.report.id}`, { headers: { Cookie: other.cookie } });
    const pdfResponse = await fetch(`${baseUrl}/reports/${report.report.id}/pdf`, { headers: { Cookie: other.cookie } });
    const csvResponse = await fetch(`${baseUrl}/reports/${report.report.id}/csv`, { headers: { Cookie: other.cookie } });
    const deleteResponse = await fetch(`${baseUrl}/reports/${report.report.id}`, {
      method: 'DELETE',
      headers: { Cookie: other.cookie }
    });
    const ownerReadResponse = await fetch(`${baseUrl}/reports/${report.report.id}`, { headers: { Cookie: owner.cookie } });

    expect(readResponse.status).toBe(404);
    expect(pdfResponse.status).toBe(404);
    expect(csvResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
    expect(ownerReadResponse.status).toBe(200);
  });

  it('deletes an owned report and export files without requiring files to exist', async () => {
    const user = await registerUser('report-delete@example.com');
    await updateProfile(user.cookie);
    const project = await createProject(user.cookie);
    await createTimeEntry(user.id, project.id, '2026-06-01', 8, 0, 'Owner work', 'FINALIZED');
    const reportResponse = await generateBasicReport(user.cookie, project.id);
    const report = await jsonBody<ReportResponse>(reportResponse);
    await rm(join(process.cwd(), report.report.pdfPath), { force: true });

    const response = await fetch(`${baseUrl}/reports/${report.report.id}`, {
      method: 'DELETE',
      headers: { Cookie: user.cookie }
    });

    expect(response.status).toBe(204);
    expect(existsSync(join(process.cwd(), report.report.csvPath))).toBe(false);
    await expect(prisma.progressClaimReport.count({ where: { id: report.report.id } })).resolves.toBe(0);
  });

  it('rejects bad periods and foreign projects', async () => {
    const owner = await registerUser('report-validation-owner@example.com');
    const other = await registerUser('report-validation-other@example.com');
    const project = await createProject(owner.cookie);

    const endBeforeStart = await postJson('/reports/progress-claim', {
      projectId: project.id,
      claimPeriodStart: '2026-06-30',
      claimPeriodEnd: '2026-06-01'
    }, owner.cookie);
    const offsetDatetime = await postJson('/reports/progress-claim', {
      projectId: project.id,
      claimPeriodStart: '2026-06-01T00:00:00+08:00',
      claimPeriodEnd: '2026-06-30'
    }, owner.cookie);
    const foreignProject = await postJson('/reports/progress-claim', {
      projectId: project.id,
      claimPeriodStart: '2026-06-01',
      claimPeriodEnd: '2026-06-30'
    }, other.cookie);

    expect(endBeforeStart.status).toBe(400);
    expect(offsetDatetime.status).toBe(400);
    expect(foreignProject.status).toBe(403);
  });

  async function registerUser(email: string): Promise<{ id: string; cookie: string }> {
    const response = await postJson('/auth/register', {
      email,
      password: 'Password123!'
    });
    expect(response.status).toBe(201);
    const body = await jsonBody<AuthUserResponse>(response);
    return { id: body.user.id, cookie: sessionCookie(response) };
  }

  function updateProfile(cookie: string): Promise<Response> {
    return requestJson('PUT', '/profile', {
      fullName: 'Tan Worker',
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

  async function createCompany(cookie: string): Promise<CompanyResponse['company']> {
    const response = await postJson('/companies', {
      name: 'ABC Construction Pte Ltd',
      uen: '202600001A',
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
    dateOnly: string,
    totalHours: number,
    overtimeHours: number,
    workDescription: string,
    status: 'DRAFT' | 'FINALIZED'
  ) {
    const date = new Date(`${dateOnly}T00:00:00.000Z`);
    return prisma.timeEntry.create({
      data: {
        userId,
        projectId,
        date,
        clockInTime: new Date(`${dateOnly}T09:00:00.000Z`),
        clockOutTime: new Date(`${dateOnly}T${String(9 + totalHours).padStart(2, '0')}:00:00.000Z`),
        breakMinutes: 0,
        totalHours,
        overtimeHours,
        workDescription,
        manualEntryFlag: true,
        locationText: 'Site A',
        status,
        notes: ''
      }
    });
  }

  function createPhoto(userId: string, projectId: string, timestamp: string, imagePath: string) {
    return prisma.photoEvidence.create({
      data: {
        userId,
        projectId,
        imagePath,
        caption: 'Completed work photo',
        evidenceType: 'COMPLETED_WORK',
        timestamp: new Date(timestamp)
      }
    });
  }

  function generateBasicReport(cookie: string, projectId: string): Promise<Response> {
    return postJson('/reports/progress-claim', {
      projectId,
      claimPeriodStart: '2026-06-01',
      claimPeriodEnd: '2026-06-30',
      hourlyRate: 30
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

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  expect(setCookie).toBeTruthy();
  return setCookie?.split(';')[0] ?? '';
}

async function jsonBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function resetExportRoot(exportRoot: string): Promise<void> {
  await rm(exportRoot, { recursive: true, force: true });
  await mkdir(exportRoot, { recursive: true });
  await writeFile(join(exportRoot, '.gitkeep'), '');
}
