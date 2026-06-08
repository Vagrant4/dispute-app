import { Prisma, RateType, TimeEntryStatus, type PaySummary } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import {
  calculateBasicPay,
  calculateGrossPay,
  calculateNetPay,
  calculateOvertimePay
} from '../../utils/payCalculations.js';

export class PaySummaryServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

export interface PayLineItemInput {
  description: string;
  amount: number;
}

export interface GeneratePaySummaryInput {
  projectId?: string | null;
  salaryPeriodStart: Date;
  salaryPeriodEnd: Date;
  rateType: RateType;
  basicRate: number;
  overtimeRate?: number;
  restDayPay?: number;
  publicHolidayPay?: number;
  allowances?: PayLineItemInput[];
  deductions?: PayLineItemInput[];
  notes?: string;
}

export type PaySummaryWithLineItems = PaySummary & {
  allowances: Array<{ description: string; amount: Prisma.Decimal }>;
  deductions: Array<{ description: string; amount: Prisma.Decimal }>;
};

export function listPaySummaries(userId: string): Promise<PaySummaryWithLineItems[]> {
  return prisma.paySummary.findMany({
    where: { userId },
    include: { allowances: true, deductions: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getPaySummary(userId: string, paySummaryId: string): Promise<PaySummaryWithLineItems> {
  const paySummary = await prisma.paySummary.findFirst({
    where: { id: paySummaryId, userId },
    include: { allowances: true, deductions: true }
  });
  if (!paySummary) {
    throw new PaySummaryServiceError('Pay summary not found', 404);
  }

  return paySummary;
}

export async function deletePaySummary(userId: string, paySummaryId: string): Promise<void> {
  const paySummary = await prisma.paySummary.findFirst({
    where: { id: paySummaryId, userId },
    select: { id: true }
  });
  if (!paySummary) {
    throw new PaySummaryServiceError('Pay summary not found', 404);
  }

  await prisma.paySummary.delete({ where: { id: paySummary.id } });
}

export async function generatePaySummary(userId: string, input: GeneratePaySummaryInput): Promise<PaySummaryWithLineItems> {
  validatePeriod(input.salaryPeriodStart, input.salaryPeriodEnd);

  const project = input.projectId ? await getOwnedProjectOrThrow(userId, input.projectId) : null;
  const [timeTotals, setting, profile] = await Promise.all([
    getFinalizedTimeTotals(userId, input.salaryPeriodStart, input.salaryPeriodEnd, input.projectId),
    prisma.appSetting.findUnique({
      where: { userId },
      select: { overtimeMultiplier: true }
    }),
    prisma.workerProfile.findUnique({
      where: { userId },
      select: { fullName: true }
    })
  ]);

  const allowances = input.allowances ?? [];
  const deductions = input.deductions ?? [];
  const totalAllowances = sumMoney(allowances.map((allowance) => allowance.amount));
  const totalDeductions = sumMoney(deductions.map((deduction) => deduction.amount));
  const restDayPay = input.restDayPay ?? 0;
  const publicHolidayPay = input.publicHolidayPay ?? 0;
  const overtimeRate = input.overtimeRate ?? roundMoney(input.basicRate * (setting?.overtimeMultiplier ?? 1.5));

  let basicPay: number;
  let overtimePay: number;
  let grossPay: number;
  let netPay: number;
  try {
    basicPay = calculateBasicPay(timeTotals.regularHours, input.basicRate);
    overtimePay = calculateOvertimePay(timeTotals.overtimeHours, overtimeRate);
    grossPay = calculateGrossPay(basicPay, overtimePay, totalAllowances, restDayPay, publicHolidayPay);
    netPay = calculateNetPay(grossPay, totalDeductions);
  } catch (error) {
    if (error instanceof Error) {
      throw new PaySummaryServiceError(error.message, 400);
    }
    throw error;
  }

  const itemisedPayslipJson = JSON.stringify({
    workerName: profile?.fullName ?? null,
    clientCompanyName: project?.company?.name ?? null,
    paymentDate: formatDateOnly(new Date()),
    salaryPeriodStart: formatDateOnly(input.salaryPeriodStart),
    salaryPeriodEnd: formatDateOnly(input.salaryPeriodEnd),
    basicPay,
    allowances,
    deductions,
    overtimeHours: timeTotals.overtimeHours,
    overtimePay,
    grossPay,
    netPay,
    notes: input.notes ?? ''
  });

  return prisma.paySummary.create({
    data: {
      userId,
      projectId: input.projectId ?? null,
      salaryPeriodStart: input.salaryPeriodStart,
      salaryPeriodEnd: input.salaryPeriodEnd,
      rateType: input.rateType,
      basicRate: input.basicRate,
      basicPay,
      overtimeRate,
      overtimePay,
      restDayPay,
      publicHolidayPay,
      totalAllowances,
      totalDeductions,
      grossPay,
      netPay,
      itemisedPayslipJson,
      notes: input.notes ?? '',
      allowances: {
        create: allowances.map((allowance) => ({
          description: allowance.description,
          amount: allowance.amount
        }))
      },
      deductions: {
        create: deductions.map((deduction) => ({
          description: deduction.description,
          amount: deduction.amount
        }))
      }
    },
    include: { allowances: true, deductions: true }
  });
}

async function getOwnedProjectOrThrow(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: { company: { select: { name: true } } }
  });
  if (!project) {
    throw new PaySummaryServiceError('Project does not belong to the current user', 403);
  }

  return project;
}

async function getFinalizedTimeTotals(
  userId: string,
  salaryPeriodStart: Date,
  salaryPeriodEnd: Date,
  projectId: string | null | undefined
): Promise<{ regularHours: number; overtimeHours: number }> {
  const entries = await prisma.timeEntry.findMany({
    where: {
      userId,
      ...(projectId ? { projectId } : {}),
      status: TimeEntryStatus.FINALIZED,
      date: {
        gte: salaryPeriodStart,
        lte: salaryPeriodEnd
      }
    },
    select: {
      totalHours: true,
      overtimeHours: true
    }
  });

  return entries.reduce(
    (totals, entry) => {
      const overtimeHours = roundHours(entry.overtimeHours);
      const regularHours = roundHours(Math.max(0, entry.totalHours - overtimeHours));

      return {
        regularHours: roundHours(totals.regularHours + regularHours),
        overtimeHours: roundHours(totals.overtimeHours + overtimeHours)
      };
    },
    { regularHours: 0, overtimeHours: 0 }
  );
}

function validatePeriod(salaryPeriodStart: Date, salaryPeriodEnd: Date): void {
  if (!Number.isFinite(salaryPeriodStart.getTime()) || !Number.isFinite(salaryPeriodEnd.getTime())) {
    throw new PaySummaryServiceError('Salary period dates must be valid', 400);
  }

  if (salaryPeriodEnd < salaryPeriodStart) {
    throw new PaySummaryServiceError('salaryPeriodEnd must be on or after salaryPeriodStart', 400);
  }
}

function sumMoney(amounts: number[]): number {
  return amounts.reduce((total, amount) => roundMoney(total + amount), 0);
}

function roundMoney(value: number): number {
  const factor = 100;

  return Math.round((value + Number.EPSILON * Math.sign(value) * factor) * factor) / factor;
}

function roundHours(value: number): number {
  const factor = 100;

  return Math.round((value + Number.EPSILON * Math.sign(value) * factor) * factor) / factor;
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
