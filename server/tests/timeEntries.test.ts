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

interface ProjectResponse {
  project: {
    id: string;
    userId: string;
    projectName: string;
  };
}

interface TimeEntryResponse {
  timeEntry: {
    id: string;
    userId: string;
    projectId: string;
    clockInTime: string;
    clockOutTime: string | null;
    breakMinutes: number;
    totalHours: number;
    overtimeHours: number;
    manualEntryFlag: boolean;
    status: string;
  };
}

interface TimeEntriesResponse {
  timeEntries: TimeEntryResponse['timeEntry'][];
}

describe('time entries API', () => {
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

  it('creates a manual entry and marks it as manual', async () => {
    const user = await registerUser('manual-entry@example.com');
    const project = await createProject(user.cookie);

    const response = await postJson('/time-entries', manualEntryPayload(project.id), user.cookie);

    expect(response.status).toBe(201);
    const body = await jsonBody<TimeEntryResponse>(response);
    expect(body.timeEntry).toMatchObject({
      userId: user.id,
      projectId: project.id,
      manualEntryFlag: true,
      totalHours: 7,
      overtimeHours: 0,
      status: 'DRAFT'
    });
  });

  it('lists only the current user time entries', async () => {
    const userA = await registerUser('list-a@example.com');
    const userB = await registerUser('list-b@example.com');
    const projectA = await createProject(userA.cookie);
    const projectB = await createProject(userB.cookie);
    const entryAResponse = await postJson('/time-entries', manualEntryPayload(projectA.id, {
      workDescription: 'Visible entry'
    }), userA.cookie);
    const entryA = await jsonBody<TimeEntryResponse>(entryAResponse);
    await postJson('/time-entries', manualEntryPayload(projectB.id, {
      workDescription: 'Hidden entry'
    }), userB.cookie);

    const response = await fetch(`${baseUrl}/time-entries`, {
      headers: { Cookie: userA.cookie }
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<TimeEntriesResponse>(response);
    expect(body.timeEntries).toHaveLength(1);
    expect(body.timeEntries[0]).toMatchObject({
      id: entryA.timeEntry.id,
      userId: userA.id,
      projectId: projectA.id,
      workDescription: 'Visible entry'
    });
  });

  it('reads a time entry by id', async () => {
    const user = await registerUser('read-entry@example.com');
    const project = await createProject(user.cookie);
    const createResponse = await postJson('/time-entries', manualEntryPayload(project.id), user.cookie);
    const created = await jsonBody<TimeEntryResponse>(createResponse);

    const response = await fetch(`${baseUrl}/time-entries/${created.timeEntry.id}`, {
      headers: { Cookie: user.cookie }
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<TimeEntryResponse>(response);
    expect(body.timeEntry).toMatchObject({
      id: created.timeEntry.id,
      userId: user.id,
      projectId: project.id,
      totalHours: 7,
      overtimeHours: 0
    });
  });

  it('updates a time entry and recalculates totals when time fields change', async () => {
    const user = await registerUser('update-entry@example.com');
    const project = await createProject(user.cookie);
    const createResponse = await postJson('/time-entries', manualEntryPayload(project.id), user.cookie);
    const created = await jsonBody<TimeEntryResponse>(createResponse);

    const response = await putJson(`/time-entries/${created.timeEntry.id}`, {
      clockInTime: '2026-06-01T08:00:00.000Z',
      clockOutTime: '2026-06-01T19:00:00.000Z',
      breakMinutes: 30,
      workDescription: 'Updated installation work',
      notes: 'Recalculated from updated clock times'
    }, user.cookie);

    expect(response.status).toBe(200);
    const body = await jsonBody<TimeEntryResponse>(response);
    expect(body.timeEntry).toMatchObject({
      id: created.timeEntry.id,
      workDescription: 'Updated installation work',
      notes: 'Recalculated from updated clock times',
      totalHours: 10.5,
      overtimeHours: 2.5
    });
    expect(body.timeEntry.clockInTime).toBe('2026-06-01T08:00:00.000Z');
    expect(body.timeEntry.clockOutTime).toBe('2026-06-01T19:00:00.000Z');
  });

  it('rejects direct status changes through generic update', async () => {
    const user = await registerUser('update-status-reject@example.com');
    const project = await createProject(user.cookie);
    const createResponse = await postJson('/time-entries', manualEntryPayload(project.id), user.cookie);
    const created = await jsonBody<TimeEntryResponse>(createResponse);

    const response = await putJson(`/time-entries/${created.timeEntry.id}`, {
      status: 'FINALIZED'
    }, user.cookie);
    const readResponse = await fetch(`${baseUrl}/time-entries/${created.timeEntry.id}`, {
      headers: { Cookie: user.cookie }
    });
    const readBody = await jsonBody<TimeEntryResponse>(readResponse);

    expect(response.status).toBe(400);
    expect(readBody.timeEntry.status).toBe('DRAFT');
  });

  it('rejects nulling out clock-out through generic update', async () => {
    const user = await registerUser('update-null-clock-out-reject@example.com');
    const project = await createProject(user.cookie);
    const createResponse = await postJson('/time-entries', manualEntryPayload(project.id), user.cookie);
    const created = await jsonBody<TimeEntryResponse>(createResponse);

    const response = await putJson(`/time-entries/${created.timeEntry.id}`, {
      clockOutTime: null
    }, user.cookie);
    const readResponse = await fetch(`${baseUrl}/time-entries/${created.timeEntry.id}`, {
      headers: { Cookie: user.cookie }
    });
    const readBody = await jsonBody<TimeEntryResponse>(readResponse);

    expect(response.status).toBe(400);
    expect(readBody.timeEntry.clockOutTime).toBe('2026-06-01T17:00:00.000Z');
    expect(readBody.timeEntry.totalHours).toBe(7);
  });

  it('returns 409 when changing project on a time entry with linked photo evidence', async () => {
    const user = await registerUser('update-project-evidence-conflict@example.com');
    const project = await createProject(user.cookie);
    const replacementProject = await createProject(user.cookie);
    const createResponse = await postJson('/time-entries', manualEntryPayload(project.id), user.cookie);
    const created = await jsonBody<TimeEntryResponse>(createResponse);
    await prisma.photoEvidence.create({
      data: {
        userId: user.id,
        projectId: project.id,
        timeEntryId: created.timeEntry.id,
        imagePath: '/uploads/evidence/update-project-conflict.jpg',
        caption: 'Evidence tied to original project',
        evidenceType: 'COMPLETED_WORK',
        timestamp: new Date('2026-06-01T17:30:00.000Z')
      }
    });

    const response = await putJson(`/time-entries/${created.timeEntry.id}`, {
      projectId: replacementProject.id
    }, user.cookie);
    const readResponse = await fetch(`${baseUrl}/time-entries/${created.timeEntry.id}`, {
      headers: { Cookie: user.cookie }
    });
    const readBody = await jsonBody<TimeEntryResponse>(readResponse);

    expect(response.status).toBe(409);
    expect(readBody.timeEntry.projectId).toBe(project.id);
  });

  it('deletes a time entry', async () => {
    const user = await registerUser('delete-entry@example.com');
    const project = await createProject(user.cookie);
    const createResponse = await postJson('/time-entries', manualEntryPayload(project.id), user.cookie);
    const created = await jsonBody<TimeEntryResponse>(createResponse);

    const response = await fetch(`${baseUrl}/time-entries/${created.timeEntry.id}`, {
      method: 'DELETE',
      headers: { Cookie: user.cookie }
    });
    const readAfterDelete = await fetch(`${baseUrl}/time-entries/${created.timeEntry.id}`, {
      headers: { Cookie: user.cookie }
    });

    expect(response.status).toBe(204);
    expect(readAfterDelete.status).toBe(404);
  });

  it('rejects creating a time entry for another user project', async () => {
    const projectOwner = await registerUser('project-owner@example.com');
    const currentUser = await registerUser('project-reject@example.com');
    const otherProject = await createProject(projectOwner.cookie);

    const response = await postJson('/time-entries', manualEntryPayload(otherProject.id), currentUser.cookie);

    expect(response.status).toBe(403);
  });

  it('rejects clock-out before clock-in', async () => {
    const user = await registerUser('clock-before@example.com');
    const project = await createProject(user.cookie);

    const response = await postJson('/time-entries', manualEntryPayload(project.id, {
      clockInTime: '2026-06-01T17:00:00.000Z',
      clockOutTime: '2026-06-01T09:00:00.000Z'
    }), user.cookie);

    expect(response.status).toBe(400);
  });

  it('rejects clock-out endpoint when clock-out is before clock-in', async () => {
    const user = await registerUser('clock-out-before-clock-in@example.com');
    const project = await createProject(user.cookie);
    const clockInResponse = await postJson('/time-entries/clock-in', {
      projectId: project.id,
      clockInTime: '2026-06-01T17:00:00.000Z'
    }, user.cookie);
    const clockIn = await jsonBody<TimeEntryResponse>(clockInResponse);

    const response = await postJson(`/time-entries/${clockIn.timeEntry.id}/clock-out`, {
      clockOutTime: '2026-06-01T09:00:00.000Z',
      breakMinutes: 0
    }, user.cookie);

    expect(response.status).toBe(400);
  });

  it('rejects clock-out endpoint when break exceeds on-site duration', async () => {
    const user = await registerUser('clock-out-break-exceeds@example.com');
    const project = await createProject(user.cookie);
    const clockInResponse = await postJson('/time-entries/clock-in', {
      projectId: project.id,
      clockInTime: '2026-06-01T09:00:00.000Z'
    }, user.cookie);
    const clockIn = await jsonBody<TimeEntryResponse>(clockInResponse);

    const response = await postJson(`/time-entries/${clockIn.timeEntry.id}/clock-out`, {
      clockOutTime: '2026-06-01T10:00:00.000Z',
      breakMinutes: 61
    }, user.cookie);

    expect(response.status).toBe(400);
  });

  it('rejects inclusive break minutes exceeding on-site duration', async () => {
    const user = await registerUser('break-exceeds@example.com');
    const project = await createProject(user.cookie);

    const response = await postJson('/time-entries', manualEntryPayload(project.id, {
      clockInTime: '2026-06-01T09:00:00.000Z',
      clockOutTime: '2026-06-01T10:00:00.000Z',
      breakMinutes: 61
    }), user.cookie);

    expect(response.status).toBe(400);
  });

  it('calculates overtime from the user standard daily hours setting', async () => {
    const user = await registerUser('overtime@example.com');
    await prisma.appSetting.update({
      where: { userId: user.id },
      data: { standardDailyHours: 7.5 }
    });
    const project = await createProject(user.cookie);

    const response = await postJson('/time-entries', manualEntryPayload(project.id, {
      clockInTime: '2026-06-01T08:00:00.000Z',
      clockOutTime: '2026-06-01T18:00:00.000Z',
      breakMinutes: 30
    }), user.cookie);

    expect(response.status).toBe(201);
    const body = await jsonBody<TimeEntryResponse>(response);
    expect(body.timeEntry.totalHours).toBe(9.5);
    expect(body.timeEntry.overtimeHours).toBe(2);
  });

  it('uses the default overtime threshold of 8 hours when no app setting exists', async () => {
    const user = await registerUser('default-overtime@example.com');
    await prisma.appSetting.delete({ where: { userId: user.id } });
    const project = await createProject(user.cookie);

    const response = await postJson('/time-entries', manualEntryPayload(project.id, {
      clockInTime: '2026-06-01T08:00:00.000Z',
      clockOutTime: '2026-06-01T18:00:00.000Z',
      breakMinutes: 60
    }), user.cookie);

    expect(response.status).toBe(201);
    const body = await jsonBody<TimeEntryResponse>(response);
    expect(body.timeEntry.totalHours).toBe(9);
    expect(body.timeEntry.overtimeHours).toBe(1);
  });

  it('creates an active draft entry on clock-in', async () => {
    const user = await registerUser('clock-in@example.com');
    const project = await createProject(user.cookie);

    const response = await postJson('/time-entries/clock-in', {
      projectId: project.id,
      clockInTime: '2026-06-01T09:00:00.000Z',
      workDescription: 'Started steel bracket installation',
      locationText: 'Site A',
      clockInGpsLat: 1.3521,
      clockInGpsLng: 103.8198
    }, user.cookie);

    expect(response.status).toBe(201);
    const body = await jsonBody<TimeEntryResponse>(response);
    expect(body.timeEntry).toMatchObject({
      projectId: project.id,
      clockOutTime: null,
      breakMinutes: 0,
      totalHours: 0,
      overtimeHours: 0,
      manualEntryFlag: false,
      status: 'DRAFT'
    });
  });

  it('updates an active clock entry on clock-out', async () => {
    const user = await registerUser('clock-out@example.com');
    const project = await createProject(user.cookie);
    const clockInResponse = await postJson('/time-entries/clock-in', {
      projectId: project.id,
      clockInTime: '2026-06-01T09:00:00.000Z'
    }, user.cookie);
    const clockIn = await jsonBody<TimeEntryResponse>(clockInResponse);

    const response = await postJson(`/time-entries/${clockIn.timeEntry.id}/clock-out`, {
      clockOutTime: '2026-06-01T18:00:00.000Z',
      breakMinutes: 60,
      clockOutGpsLat: 1.3,
      clockOutGpsLng: 103.8
    }, user.cookie);

    expect(response.status).toBe(200);
    const body = await jsonBody<TimeEntryResponse>(response);
    expect(body.timeEntry.clockOutTime).toBe('2026-06-01T18:00:00.000Z');
    expect(body.timeEntry.totalHours).toBe(8);
    expect(body.timeEntry.overtimeHours).toBe(0);
  });

  it('finalizes a draft entry', async () => {
    const user = await registerUser('finalize@example.com');
    const project = await createProject(user.cookie);
    const createResponse = await postJson('/time-entries', manualEntryPayload(project.id), user.cookie);
    const created = await jsonBody<TimeEntryResponse>(createResponse);

    const response = await postJson(`/time-entries/${created.timeEntry.id}/finalize`, {}, user.cookie);

    expect(response.status).toBe(200);
    const body = await jsonBody<TimeEntryResponse>(response);
    expect(body.timeEntry.status).toBe('FINALIZED');
  });

  it('rejects finalizing an active clock-in without clock-out', async () => {
    const user = await registerUser('finalize-active-reject@example.com');
    const project = await createProject(user.cookie);
    const clockInResponse = await postJson('/time-entries/clock-in', {
      projectId: project.id,
      clockInTime: '2026-06-01T09:00:00.000Z'
    }, user.cookie);
    const clockIn = await jsonBody<TimeEntryResponse>(clockInResponse);

    const response = await postJson(`/time-entries/${clockIn.timeEntry.id}/finalize`, {}, user.cookie);
    const readResponse = await fetch(`${baseUrl}/time-entries/${clockIn.timeEntry.id}`, {
      headers: { Cookie: user.cookie }
    });
    const readBody = await jsonBody<TimeEntryResponse>(readResponse);

    expect([400, 409]).toContain(response.status);
    expect(readBody.timeEntry).toMatchObject({
      clockOutTime: null,
      status: 'DRAFT',
      totalHours: 0,
      overtimeHours: 0
    });
  });

  it('returns 409 when deleting a time entry with dependent photo evidence', async () => {
    const user = await registerUser('delete-conflict@example.com');
    const project = await createProject(user.cookie);
    const createResponse = await postJson('/time-entries', manualEntryPayload(project.id), user.cookie);
    const created = await jsonBody<TimeEntryResponse>(createResponse);
    await prisma.photoEvidence.create({
      data: {
        userId: user.id,
        projectId: project.id,
        timeEntryId: created.timeEntry.id,
        imagePath: '/uploads/evidence/delete-conflict.jpg',
        caption: 'Completed bracket evidence',
        evidenceType: 'COMPLETED_WORK',
        timestamp: new Date('2026-06-01T17:30:00.000Z')
      }
    });

    const response = await fetch(`${baseUrl}/time-entries/${created.timeEntry.id}`, {
      method: 'DELETE',
      headers: { Cookie: user.cookie }
    });

    expect(response.status).toBe(409);
  });

  it('denies cross-user access to another user time entry', async () => {
    const userA = await registerUser('time-a@example.com');
    const userB = await registerUser('time-b@example.com');
    const project = await createProject(userA.cookie);
    const createResponse = await postJson('/time-entries', manualEntryPayload(project.id), userA.cookie);
    const created = await jsonBody<TimeEntryResponse>(createResponse);

    const readResponse = await fetch(`${baseUrl}/time-entries/${created.timeEntry.id}`, {
      headers: { Cookie: userB.cookie }
    });
    const updateResponse = await putJson(`/time-entries/${created.timeEntry.id}`, { notes: 'tampered' }, userB.cookie);
    const deleteResponse = await fetch(`${baseUrl}/time-entries/${created.timeEntry.id}`, {
      method: 'DELETE',
      headers: { Cookie: userB.cookie }
    });

    expect(readResponse.status).toBe(404);
    expect(updateResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
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

  async function createProject(cookie: string): Promise<ProjectResponse['project']> {
    const response = await postJson('/projects', {
      companyId: null,
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

function manualEntryPayload(projectId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    projectId,
    date: '2026-06-01',
    clockInTime: '2026-06-01T09:00:00.000Z',
    clockOutTime: '2026-06-01T17:00:00.000Z',
    breakMinutes: 60,
    workDescription: 'Installed steel brackets',
    locationText: 'Site A',
    notes: '',
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
