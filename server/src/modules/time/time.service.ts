import { Prisma, TimeEntryStatus, type TimeEntry } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { calculateOvertimeHours, calculateTotalHours } from '../../utils/timeCalculations.js';

export class TimeEntryServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

export interface CreateManualEntryInput {
  projectId: string;
  date?: Date;
  clockInTime: Date;
  clockOutTime: Date;
  breakMinutes?: number;
  workDescription?: string;
  locationText?: string;
  clockInGpsLat?: number | null;
  clockInGpsLng?: number | null;
  clockOutGpsLat?: number | null;
  clockOutGpsLng?: number | null;
  notes?: string;
}

export interface ClockInInput {
  projectId: string;
  date?: Date;
  clockInTime?: Date;
  workDescription?: string;
  locationText?: string;
  clockInGpsLat?: number | null;
  clockInGpsLng?: number | null;
  notes?: string;
}

export interface ClockOutInput {
  clockOutTime: Date;
  breakMinutes?: number;
  clockOutGpsLat?: number | null;
  clockOutGpsLng?: number | null;
  locationText?: string;
  workDescription?: string;
  notes?: string;
}

export interface UpdateTimeEntryInput {
  projectId?: string;
  date?: Date;
  clockInTime?: Date;
  clockOutTime?: Date;
  breakMinutes?: number;
  workDescription?: string;
  locationText?: string;
  clockInGpsLat?: number | null;
  clockInGpsLng?: number | null;
  clockOutGpsLat?: number | null;
  clockOutGpsLng?: number | null;
  notes?: string;
}

export async function createManualEntry(userId: string, input: CreateManualEntryInput): Promise<TimeEntry> {
  await verifyProjectOwnership(userId, input.projectId);
  const breakMinutes = input.breakMinutes ?? 0;
  const totals = await calculateTotals(userId, input.clockInTime, input.clockOutTime, breakMinutes);

  return prisma.timeEntry.create({
    data: {
      userId,
      projectId: input.projectId,
      date: input.date ?? dateOnly(input.clockInTime),
      clockInTime: input.clockInTime,
      clockOutTime: input.clockOutTime,
      breakMinutes,
      totalHours: totals.totalHours,
      overtimeHours: totals.overtimeHours,
      workDescription: input.workDescription ?? '',
      manualEntryFlag: true,
      locationText: input.locationText ?? '',
      clockInGpsLat: input.clockInGpsLat,
      clockInGpsLng: input.clockInGpsLng,
      clockOutGpsLat: input.clockOutGpsLat,
      clockOutGpsLng: input.clockOutGpsLng,
      notes: input.notes ?? ''
    }
  });
}

export async function clockIn(userId: string, input: ClockInInput): Promise<TimeEntry> {
  await verifyProjectOwnership(userId, input.projectId);
  const clockInTime = input.clockInTime ?? new Date();

  return prisma.timeEntry.create({
    data: {
      userId,
      projectId: input.projectId,
      date: input.date ?? dateOnly(clockInTime),
      clockInTime,
      clockOutTime: null,
      breakMinutes: 0,
      totalHours: 0,
      overtimeHours: 0,
      workDescription: input.workDescription ?? '',
      manualEntryFlag: false,
      locationText: input.locationText ?? '',
      clockInGpsLat: input.clockInGpsLat,
      clockInGpsLng: input.clockInGpsLng,
      notes: input.notes ?? '',
      status: TimeEntryStatus.DRAFT
    }
  });
}

export async function clockOut(userId: string, entryId: string, input: ClockOutInput): Promise<TimeEntry> {
  const existing = await getOwnedEntryOrThrow(userId, entryId);
  const breakMinutes = input.breakMinutes ?? existing.breakMinutes;
  const totals = await calculateTotals(userId, existing.clockInTime, input.clockOutTime, breakMinutes);

  return prisma.timeEntry.update({
    where: { id: existing.id },
    data: {
      clockOutTime: input.clockOutTime,
      breakMinutes,
      totalHours: totals.totalHours,
      overtimeHours: totals.overtimeHours,
      clockOutGpsLat: input.clockOutGpsLat,
      clockOutGpsLng: input.clockOutGpsLng,
      ...(input.locationText !== undefined ? { locationText: input.locationText } : {}),
      ...(input.workDescription !== undefined ? { workDescription: input.workDescription } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {})
    }
  });
}

export async function finalize(userId: string, entryId: string): Promise<TimeEntry> {
  const existing = await getOwnedEntryOrThrow(userId, entryId);
  if (!existing.clockOutTime) {
    throw new TimeEntryServiceError('Time entry must be clocked out before it can be finalized', 409);
  }
  const totals = await calculateTotals(userId, existing.clockInTime, existing.clockOutTime, existing.breakMinutes);
  assertCompletedTotals(totals.totalHours, totals.overtimeHours);

  return prisma.timeEntry.update({
    where: { id: existing.id },
    data: {
      status: TimeEntryStatus.FINALIZED,
      totalHours: totals.totalHours,
      overtimeHours: totals.overtimeHours
    }
  });
}

export function listEntries(userId: string): Promise<TimeEntry[]> {
  return prisma.timeEntry.findMany({
    where: { userId },
    orderBy: [{ date: 'desc' }, { clockInTime: 'desc' }]
  });
}

export async function getEntry(userId: string, entryId: string): Promise<TimeEntry> {
  return getOwnedEntryOrThrow(userId, entryId);
}

export async function updateEntry(userId: string, entryId: string, input: UpdateTimeEntryInput): Promise<TimeEntry> {
  const existing = await getOwnedEntryOrThrow(userId, entryId);
  if (input.projectId !== undefined && input.projectId !== existing.projectId) {
    await verifyProjectOwnership(userId, input.projectId);
    await verifyProjectChangeAllowed(userId, existing.id);
  }

  const clockInTime = input.clockInTime ?? existing.clockInTime;
  const clockOutTime = input.clockOutTime !== undefined ? input.clockOutTime : existing.clockOutTime;
  const breakMinutes = input.breakMinutes ?? existing.breakMinutes;
  const totals = clockOutTime ? await calculateTotals(userId, clockInTime, clockOutTime, breakMinutes) : { totalHours: 0, overtimeHours: 0 };

  return prisma.timeEntry.update({
    where: { id: existing.id },
    data: {
      ...defined({
        projectId: input.projectId,
        date: input.date,
        clockInTime: input.clockInTime,
        clockOutTime: input.clockOutTime,
        breakMinutes: input.breakMinutes,
        workDescription: input.workDescription,
        locationText: input.locationText,
        clockInGpsLat: input.clockInGpsLat,
        clockInGpsLng: input.clockInGpsLng,
        clockOutGpsLat: input.clockOutGpsLat,
        clockOutGpsLng: input.clockOutGpsLng,
        notes: input.notes
      }),
      totalHours: totals.totalHours,
      overtimeHours: totals.overtimeHours
    }
  });
}

export async function deleteEntry(userId: string, entryId: string): Promise<void> {
  const existing = await getOwnedEntryOrThrow(userId, entryId);
  const photoEvidenceCount = await prisma.photoEvidence.count({
    where: { userId, timeEntryId: existing.id }
  });
  if (photoEvidenceCount > 0) {
    throw new TimeEntryServiceError('Time entry cannot be deleted while it has photo evidence', 409);
  }

  await prisma.timeEntry.delete({ where: { id: existing.id } });
}

async function getOwnedEntryOrThrow(userId: string, entryId: string): Promise<TimeEntry> {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, userId }
  });
  if (!entry) {
    throw new TimeEntryServiceError('Time entry not found', 404);
  }

  return entry;
}

async function verifyProjectOwnership(userId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true }
  });
  if (!project) {
    throw new TimeEntryServiceError('Project does not belong to the current user', 403);
  }
}

async function verifyProjectChangeAllowed(userId: string, entryId: string): Promise<void> {
  const photoEvidenceCount = await prisma.photoEvidence.count({
    where: { userId, timeEntryId: entryId }
  });
  if (photoEvidenceCount > 0) {
    throw new TimeEntryServiceError('Time entry project cannot be changed while it has linked photo evidence', 409);
  }
}

async function calculateTotals(
  userId: string,
  clockInTime: Date,
  clockOutTime: Date,
  breakMinutes: number
): Promise<{ totalHours: number; overtimeHours: number }> {
  try {
    const totalHours = calculateTotalHours(clockInTime, clockOutTime, breakMinutes);
    const standardDailyHours = await getStandardDailyHours(userId);
    return {
      totalHours,
      overtimeHours: calculateOvertimeHours(totalHours, standardDailyHours)
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new TimeEntryServiceError(error.message, 400);
    }
    throw error;
  }
}

async function getStandardDailyHours(userId: string): Promise<number> {
  const setting = await prisma.appSetting.findUnique({
    where: { userId },
    select: { standardDailyHours: true }
  });

  return setting?.standardDailyHours ?? 8;
}

function dateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function assertCompletedTotals(totalHours: number, overtimeHours: number): void {
  if (!Number.isFinite(totalHours) || totalHours <= 0 || !Number.isFinite(overtimeHours) || overtimeHours < 0) {
    throw new TimeEntryServiceError('Time entry totals must be complete before it can be finalized', 409);
  }
}

function defined<T extends Prisma.TimeEntryUpdateInput>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
}
