import { afterAll, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { createManualEntry, updateEntry } from '../src/modules/time/time.service.js';

let ownerId: string | undefined;
afterAll(async () => {
  if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } });
  await prisma.$disconnect();
});

it('defaults new rows to typed and marks web-created and edited location notes as typed', async () => {
  const user = await prisma.user.create({ data: { email: 'location-source@example.com', passwordHash: 'test-only' } });
  ownerId = user.id;
  const project = await prisma.project.create({ data: { userId: user.id, projectName: 'Location test', siteAddress: '', startDate: new Date('2026-10-29'), description: '' } });
  const clockInTime = new Date('2026-10-29T01:00:00Z');
  const row = await prisma.timeEntry.create({ data: { userId: user.id, projectId: project.id, date: clockInTime, clockInTime, breakMinutes: 0, totalHours: 0, overtimeHours: 0, workDescription: '', locationText: '', notes: '' } });
  expect(row.locationSource).toBe('typed');
  const manual = await createManualEntry(user.id, { projectId: project.id, clockInTime, clockOutTime: new Date('2026-10-29T02:00:00Z'), locationText: 'Typed site note' });
  expect(manual.locationSource).toBe('typed');
  expect(manual.clockInGpsLat).toBeNull();
  await prisma.timeEntry.update({ where: { id: row.id, userId: user.id }, data: { locationSource: 'legacy' } });
  const updated = await updateEntry(user.id, row.id, { locationText: 'Edited worker note' });
  expect(updated.locationSource).toBe('typed');
  expect(updated.locationText).toBe('Edited worker note');
  expect(updated.clockInGpsLat).toBeNull();
});
