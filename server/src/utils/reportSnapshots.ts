import { basename } from 'node:path';
import type { Prisma } from '@prisma/client';

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

export interface ProgressClaimSnapshotInput {
  worker: {
    fullName: string;
    phone: string;
    workerIdentifier: string | null;
    finNric: string | null;
    trade: string;
    employmentType: string;
  } | null;
  company: {
    name: string;
    uen: string | null;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    notes: string;
  } | null;
  project: {
    id: string;
    projectName: string;
    siteAddress: string;
    poOrWorkOrderNumber: string | null;
    startDate: Date | string;
    endDate: Date | string | null;
    description: string;
    defaultHourlyRate: DecimalLike;
    defaultDailyRate: DecimalLike;
    status: string;
  };
  entries: Array<{
    id: string;
    date: Date | string;
    clockInTime: Date | string;
    clockOutTime: Date | string | null;
    breakMinutes: number;
    totalHours: number;
    overtimeHours: number;
    workDescription: string;
    manualEntryFlag: boolean;
    locationText: string;
    notes: string;
  }>;
  photos: Array<{
    id: string;
    timeEntryId: string | null;
    imagePath: string;
    caption: string;
    evidenceType: string;
    timestamp: Date | string;
    gpsLat: number | null;
    gpsLng: number | null;
  }>;
  totals: ProgressClaimTotalsSnapshot;
}

export interface ProgressClaimTotalsSnapshot {
  totalDaysWorked: number;
  totalHours: number;
  totalOvertimeHours: number;
  hourlyRate: number;
  overtimeRate: number;
  regularHours: number;
  basicPay: number;
  overtimePay: number;
  allowances: number;
  deductions: number;
  restDayPay: number;
  publicHolidayPay: number;
  grossPay: number;
  netPay: number;
  totalClaimAmount: number;
}

export interface ProgressClaimSnapshot {
  worker: {
    fullName: string | null;
    phone: string | null;
    workerIdentifier: string | null;
    finNric: string | null;
    trade: string | null;
    employmentType: string | null;
  };
  company: ProgressClaimSnapshotInput['company'];
  project: {
    id: string;
    projectName: string;
    siteAddress: string;
    poOrWorkOrderNumber: string | null;
    startDate: string;
    endDate: string | null;
    description: string;
    defaultHourlyRate: string | null;
    defaultDailyRate: string | null;
    status: string;
  };
  entries: Array<{
    id: string;
    date: string;
    clockInTime: string;
    clockOutTime: string | null;
    breakMinutes: number;
    totalHours: number;
    overtimeHours: number;
    workDescription: string;
    manualEntryFlag: boolean;
    locationText: string;
    notes: string;
  }>;
  photos: Array<{
    id: string;
    timeEntryId: string | null;
    imagePath: string;
    fileName: string;
    caption: string;
    evidenceType: string;
    timestamp: string;
    date: string;
    gpsLat: number | null;
    gpsLng: number | null;
  }>;
  totals: ProgressClaimTotalsSnapshot;
}

export function buildProgressClaimSnapshot(input: ProgressClaimSnapshotInput): ProgressClaimSnapshot {
  return deepFreeze({
    worker: input.worker
      ? {
          fullName: input.worker.fullName,
          phone: input.worker.phone,
          workerIdentifier: input.worker.workerIdentifier,
          finNric: input.worker.finNric,
          trade: input.worker.trade,
          employmentType: input.worker.employmentType
        }
      : {
          fullName: null,
          phone: null,
          workerIdentifier: null,
          finNric: null,
          trade: null,
          employmentType: null
        },
    company: input.company
      ? {
          name: input.company.name,
          uen: input.company.uen,
          contactPerson: input.company.contactPerson,
          email: input.company.email,
          phone: input.company.phone,
          address: input.company.address,
          notes: input.company.notes
        }
      : null,
    project: {
      id: input.project.id,
      projectName: input.project.projectName,
      siteAddress: input.project.siteAddress,
      poOrWorkOrderNumber: input.project.poOrWorkOrderNumber,
      startDate: formatDateOnly(input.project.startDate),
      endDate: input.project.endDate ? formatDateOnly(input.project.endDate) : null,
      description: input.project.description,
      defaultHourlyRate: decimalToString(input.project.defaultHourlyRate),
      defaultDailyRate: decimalToString(input.project.defaultDailyRate),
      status: input.project.status
    },
    entries: input.entries
      .map((entry) => ({
        id: entry.id,
        date: formatDateOnly(entry.date),
        clockInTime: formatDateTime(entry.clockInTime),
        clockOutTime: entry.clockOutTime ? formatDateTime(entry.clockOutTime) : null,
        breakMinutes: entry.breakMinutes,
        totalHours: roundNumber(entry.totalHours),
        overtimeHours: roundNumber(entry.overtimeHours),
        workDescription: entry.workDescription,
        manualEntryFlag: entry.manualEntryFlag,
        locationText: entry.locationText,
        notes: entry.notes
      }))
      .sort((left, right) => left.date.localeCompare(right.date) || left.clockInTime.localeCompare(right.clockInTime)),
    photos: input.photos
      .map((photo) => ({
        id: photo.id,
        timeEntryId: photo.timeEntryId,
        imagePath: photo.imagePath,
        fileName: basename(photo.imagePath),
        caption: photo.caption,
        evidenceType: photo.evidenceType,
        timestamp: formatDateTime(photo.timestamp),
        date: formatDateOnly(photo.timestamp),
        gpsLat: photo.gpsLat,
        gpsLng: photo.gpsLng
      }))
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.fileName.localeCompare(right.fileName)),
    totals: { ...input.totals }
  });
}

function formatDateOnly(value: Date | string): string {
  return toDate(value).toISOString().slice(0, 10);
}

function formatDateTime(value: Date | string): string {
  return toDate(value).toISOString();
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function decimalToString(value: DecimalLike): string | null {
  if (value === null || value === undefined) return null;
  return value.toString();
}

function roundNumber(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const property of Object.values(value)) {
      deepFreeze(property);
    }
  }

  return value;
}
