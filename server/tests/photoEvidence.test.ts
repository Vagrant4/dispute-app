import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.UPLOAD_ROOT = join(process.cwd(), '.test-uploads', 'photo-evidence');

interface AuthUserResponse {
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
  };
}

interface PhotoEvidenceResponse {
  photoEvidence: PhotoEvidenceRecord;
}

interface PhotoEvidenceListResponse {
  photoEvidence: PhotoEvidenceRecord[];
}

interface PhotoEvidenceRecord {
  id: string;
  userId: string;
  projectId: string;
  timeEntryId: string | null;
  imagePath: string;
  caption: string;
  evidenceType: string;
  timestamp: string;
  gpsLat: number | null;
  gpsLng: number | null;
}

describe('photoEvidence ownership API', () => {
  let server: Server;
  let baseUrl: string;
  let prisma: PrismaClient;
  let uploadRoot: string;

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
    uploadRoot = process.env.UPLOAD_ROOT!;
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
    await resetUploadRoot(uploadRoot);
  });

  afterAll(async () => {
    await resetUploadRoot(uploadRoot);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.$disconnect();
  });

  it('uploads metadata and stores the file under user-owned storage', async () => {
    const user = await registerUser('photo-upload@example.com');
    const project = await createProject(user.cookie);
    const timeEntry = await createTimeEntry(user.cookie, project.id);

    const response = await uploadPhoto(user.cookie, {
      projectId: project.id,
      timeEntryId: timeEntry.id,
      caption: '  Completed bracket installation  ',
      evidenceType: 'COMPLETED_WORK',
      timestamp: '2026-06-01T17:15:00.000Z',
      gpsLat: '1.3521',
      gpsLng: '103.8198'
    });

    expect(response.status).toBe(201);
    const body = await jsonBody<PhotoEvidenceResponse>(response);
    expect(body.photoEvidence).toMatchObject({
      userId: user.id,
      projectId: project.id,
      timeEntryId: timeEntry.id,
      caption: 'Completed bracket installation',
      evidenceType: 'COMPLETED_WORK',
      gpsLat: 1.3521,
      gpsLng: 103.8198
    });
    expect(body.photoEvidence.imagePath).toMatch(new RegExp(`^\\.test-uploads/photo-evidence/${user.id}/`));
    expect(body.photoEvidence.imagePath).not.toMatch(/^[A-Za-z]:/);
    expect(existsSync(join(process.cwd(), body.photoEvidence.imagePath))).toBe(true);

    const stored = await prisma.photoEvidence.findUnique({ where: { id: body.photoEvidence.id } });
    expect(stored?.userId).toBe(user.id);
    expect(stored?.imagePath).toBe(body.photoEvidence.imagePath);
  });

  it('rejects another user project and time entry ids on upload', async () => {
    const owner = await registerUser('photo-owner@example.com');
    const currentUser = await registerUser('photo-current@example.com');
    const ownerProject = await createProject(owner.cookie);
    const ownerEntry = await createTimeEntry(owner.cookie, ownerProject.id);

    const response = await uploadPhoto(currentUser.cookie, {
      projectId: ownerProject.id,
      timeEntryId: ownerEntry.id,
      evidenceType: 'DURING_WORK'
    });

    expect(response.status).toBe(403);
    await expect(prisma.photoEvidence.count({ where: { userId: currentUser.id } })).resolves.toBe(0);
  });

  it('rejects a same-user time entry from a different project', async () => {
    const user = await registerUser('photo-mismatched-entry@example.com');
    const project = await createProject(user.cookie);
    const otherProject = await createProject(user.cookie);
    const otherEntry = await createTimeEntry(user.cookie, otherProject.id);

    const response = await uploadPhoto(user.cookie, {
      projectId: project.id,
      timeEntryId: otherEntry.id,
      evidenceType: 'DURING_WORK'
    });

    expect(response.status).toBe(403);
    await expect(prisma.photoEvidence.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it('lists reads updates and deletes only current user photo evidence', async () => {
    const userA = await registerUser('photo-scope-a@example.com');
    const userB = await registerUser('photo-scope-b@example.com');
    const projectA = await createProject(userA.cookie);
    const projectB = await createProject(userB.cookie);
    const uploadA = await uploadPhoto(userA.cookie, {
      projectId: projectA.id,
      caption: 'Visible evidence',
      evidenceType: 'BEFORE_WORK'
    });
    const createdA = await jsonBody<PhotoEvidenceResponse>(uploadA);
    const uploadB = await uploadPhoto(userB.cookie, {
      projectId: projectB.id,
      caption: 'Hidden evidence',
      evidenceType: 'AFTER_WORK'
    });
    const createdB = await jsonBody<PhotoEvidenceResponse>(uploadB);

    const listResponse = await fetch(`${baseUrl}/photo-evidence`, {
      headers: { Cookie: userA.cookie }
    });
    const readResponse = await fetch(`${baseUrl}/photo-evidence/${createdA.photoEvidence.id}`, {
      headers: { Cookie: userA.cookie }
    });
    const updateResponse = await putJson(
      `/photo-evidence/${createdA.photoEvidence.id}`,
      {
        caption: ' Updated evidence note ',
        evidenceType: 'AFTER_WORK',
        gpsLat: 1.3,
        gpsLng: null
      },
      userA.cookie
    );
    const crossReadResponse = await fetch(`${baseUrl}/photo-evidence/${createdA.photoEvidence.id}`, {
      headers: { Cookie: userB.cookie }
    });
    const crossUpdateResponse = await putJson(
      `/photo-evidence/${createdA.photoEvidence.id}`,
      { caption: 'tampered' },
      userB.cookie
    );
    const crossDeleteResponse = await fetch(`${baseUrl}/photo-evidence/${createdA.photoEvidence.id}`, {
      method: 'DELETE',
      headers: { Cookie: userB.cookie }
    });
    const deleteResponse = await fetch(`${baseUrl}/photo-evidence/${createdA.photoEvidence.id}`, {
      method: 'DELETE',
      headers: { Cookie: userA.cookie }
    });
    const readDeletedResponse = await fetch(`${baseUrl}/photo-evidence/${createdA.photoEvidence.id}`, {
      headers: { Cookie: userA.cookie }
    });
    const storedB = await prisma.photoEvidence.findUnique({ where: { id: createdB.photoEvidence.id } });

    expect(listResponse.status).toBe(200);
    const listBody = await jsonBody<PhotoEvidenceListResponse>(listResponse);
    expect(listBody.photoEvidence).toHaveLength(1);
    expect(listBody.photoEvidence[0]).toMatchObject({
      id: createdA.photoEvidence.id,
      userId: userA.id,
      caption: 'Visible evidence'
    });
    expect(readResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    const updateBody = await jsonBody<PhotoEvidenceResponse>(updateResponse);
    expect(updateBody.photoEvidence).toMatchObject({
      caption: 'Updated evidence note',
      evidenceType: 'AFTER_WORK',
      gpsLat: 1.3,
      gpsLng: null
    });
    expect(crossReadResponse.status).toBe(404);
    expect(crossUpdateResponse.status).toBe(404);
    expect(crossDeleteResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(204);
    expect(readDeletedResponse.status).toBe(404);
    expect(existsSync(join(process.cwd(), createdA.photoEvidence.imagePath))).toBe(false);
    expect(storedB?.userId).toBe(userB.id);
  });

  it('rejects upload without a file', async () => {
    const user = await registerUser('photo-missing-file@example.com');
    const project = await createProject(user.cookie);
    const form = new FormData();
    form.set('projectId', project.id);
    form.set('evidenceType', 'OTHER');

    const response = await fetch(`${baseUrl}/photo-evidence/upload`, {
      method: 'POST',
      headers: { Cookie: user.cookie },
      body: form
    });

    expect(response.status).toBe(400);
    await expect(prisma.photoEvidence.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it('rejects non-image uploads before creating photo evidence', async () => {
    const user = await registerUser('photo-text-file@example.com');
    const project = await createProject(user.cookie);

    const response = await uploadPhoto(
      user.cookie,
      {
        projectId: project.id,
        evidenceType: 'OTHER'
      },
      new Blob(['not an image'], { type: 'text/plain' }),
      'notes.txt'
    );

    expect(response.status).toBe(400);
    await expect(jsonBody<{ error: string }>(response)).resolves.toMatchObject({
      error: expect.stringMatching(/JPEG, PNG, WebP, HEIC, or HEIF/)
    });
    await expect(prisma.photoEvidence.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it('does not delete files outside the configured upload root when imagePath is malformed', async () => {
    const user = await registerUser('photo-safe-delete@example.com');
    const project = await createProject(user.cookie);
    const outsideDir = join(process.cwd(), '.test-uploads', 'outside-photo-evidence-root');
    const outsideFile = join(outsideDir, 'keep-me.jpg');
    await mkdir(outsideDir, { recursive: true });
    await writeFile(outsideFile, 'outside upload root');
    const outsideImagePath = relative(process.cwd(), outsideFile).replaceAll('\\', '/');
    const photoEvidence = await prisma.photoEvidence.create({
      data: {
        userId: user.id,
        projectId: project.id,
        imagePath: outsideImagePath,
        caption: 'malformed storage path',
        evidenceType: 'OTHER',
        timestamp: new Date('2026-06-01T12:00:00.000Z')
      }
    });

    const response = await fetch(`${baseUrl}/photo-evidence/${photoEvidence.id}`, {
      method: 'DELETE',
      headers: { Cookie: user.cookie }
    });

    expect(response.status).toBe(204);
    expect(existsSync(outsideFile)).toBe(true);
    await rm(outsideDir, { recursive: true, force: true });
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

  async function createProject(cookie: string): Promise<ProjectResponse['project']> {
    const response = await postJson(
      '/projects',
      {
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
      },
      cookie
    );
    expect(response.status).toBe(201);
    const body = await jsonBody<ProjectResponse>(response);
    return body.project;
  }

  async function createTimeEntry(cookie: string, projectId: string): Promise<TimeEntryResponse['timeEntry']> {
    const response = await postJson(
      '/time-entries',
      {
        projectId,
        date: '2026-06-01',
        clockInTime: '2026-06-01T09:00:00.000Z',
        clockOutTime: '2026-06-01T17:00:00.000Z',
        breakMinutes: 60,
        workDescription: 'Installed steel brackets',
        locationText: 'Site A',
        notes: ''
      },
      cookie
    );
    expect(response.status).toBe(201);
    const body = await jsonBody<TimeEntryResponse>(response);
    return body.timeEntry;
  }

  function uploadPhoto(
    cookie: string,
    fields: Record<string, string>,
    file: Blob = new Blob(['fake image data'], { type: 'image/jpeg' }),
    fileName = 'evidence.jpg'
  ): Promise<Response> {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    form.set('file', file, fileName);

    return fetch(`${baseUrl}/photo-evidence/upload`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form
    });
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

async function resetUploadRoot(uploadRoot: string): Promise<void> {
  await rm(uploadRoot, { recursive: true, force: true });
  await mkdir(uploadRoot, { recursive: true });
  await writeFile(join(uploadRoot, '.gitkeep'), '');
}
