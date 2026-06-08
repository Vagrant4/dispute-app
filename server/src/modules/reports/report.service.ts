import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Prisma, TimeEntryStatus, type ProgressClaimReport } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { prisma } from '../../db/prisma.js';
import { calculateBasicPay, calculateGrossPay, calculateNetPay, calculateOvertimePay } from '../../utils/payCalculations.js';
import { buildProgressClaimSnapshot, type ProgressClaimSnapshot, type ProgressClaimTotalsSnapshot } from '../../utils/reportSnapshots.js';

const disclaimer =
  'This app helps you record work, time, pay, and evidence for reference. It does not replace legal, accounting, or MOM advice.';

export class ReportServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

export interface GenerateProgressClaimReportInput {
  projectId: string;
  claimPeriodStart: Date;
  claimPeriodEnd: Date;
  hourlyRate?: number;
  overtimeRate?: number;
  allowances?: number;
  deductions?: number;
  restDayPay?: number;
  publicHolidayPay?: number;
  notes?: string;
}

export interface ReportFileResult {
  report: ProgressClaimReport;
  absolutePath: string;
  fileName: string;
  contentType: string;
}

export function listReports(userId: string): Promise<ProgressClaimReport[]> {
  return prisma.progressClaimReport.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getReport(userId: string, reportId: string): Promise<ProgressClaimReport> {
  const report = await prisma.progressClaimReport.findFirst({ where: { id: reportId, userId } });
  if (!report) {
    throw new ReportServiceError('Report not found', 404);
  }

  return report;
}

export async function generateProgressClaimReport(
  userId: string,
  input: GenerateProgressClaimReportInput
): Promise<ProgressClaimReport> {
  validatePeriod(input.claimPeriodStart, input.claimPeriodEnd);
  const { queryStart, queryEndExclusive } = getDateOnlyPeriodBounds(input.claimPeriodStart, input.claimPeriodEnd);

  const project = await prisma.project.findFirst({
    where: { id: input.projectId, userId },
    include: { company: true }
  });
  if (!project) {
    throw new ReportServiceError('Project does not belong to the current user', 403);
  }

  const [worker, setting, entries, photos] = await Promise.all([
    prisma.workerProfile.findUnique({ where: { userId } }),
    prisma.appSetting.findUnique({ where: { userId }, select: { overtimeMultiplier: true } }),
    prisma.timeEntry.findMany({
      where: {
        userId,
        projectId: project.id,
        status: TimeEntryStatus.FINALIZED,
        date: { gte: queryStart, lt: queryEndExclusive }
      },
      orderBy: [{ date: 'asc' }, { clockInTime: 'asc' }]
    }),
    prisma.photoEvidence.findMany({
      where: {
        userId,
        projectId: project.id,
        timestamp: { gte: queryStart, lt: queryEndExclusive }
      },
      orderBy: [{ timestamp: 'asc' }, { imagePath: 'asc' }]
    })
  ]);

  const hourlyRate = input.hourlyRate ?? decimalToNumber(project.defaultHourlyRate) ?? decimalToNumber(worker?.defaultHourlyRate) ?? 0;
  const overtimeRate = input.overtimeRate ?? roundMoney(hourlyRate * (setting?.overtimeMultiplier ?? 1.5));
  const regularHours = roundHours(entries.reduce((total, entry) => total + Math.max(0, entry.totalHours - entry.overtimeHours), 0));
  const totalHours = roundHours(entries.reduce((total, entry) => total + entry.totalHours, 0));
  const totalOvertimeHours = roundHours(entries.reduce((total, entry) => total + entry.overtimeHours, 0));
  const totalDaysWorked = new Set(entries.map((entry) => entry.date.toISOString().slice(0, 10))).size;
  const allowances = input.allowances ?? 0;
  const deductions = input.deductions ?? 0;
  const restDayPay = input.restDayPay ?? 0;
  const publicHolidayPay = input.publicHolidayPay ?? 0;

  const basicPay = calculateBasicPay(regularHours, hourlyRate);
  const overtimePay = calculateOvertimePay(totalOvertimeHours, overtimeRate);
  const grossPay = calculateGrossPay(basicPay, overtimePay, allowances, restDayPay, publicHolidayPay);
  const netPay = calculateNetPay(grossPay, deductions);
  const totals: ProgressClaimTotalsSnapshot = {
    totalDaysWorked,
    totalHours,
    totalOvertimeHours,
    hourlyRate,
    overtimeRate,
    regularHours,
    basicPay,
    overtimePay,
    allowances,
    deductions,
    restDayPay,
    publicHolidayPay,
    grossPay,
    netPay,
    totalClaimAmount: netPay
  };

  const snapshot = buildProgressClaimSnapshot({
    worker,
    company: project.company,
    project,
    entries,
    photos,
    totals
  });
  const paths = await prepareExportPaths(userId);
  const csv = buildCsv(snapshot, input.claimPeriodStart, input.claimPeriodEnd);
  await writeFile(paths.absoluteCsvPath, csv, 'utf8');
  await writePdf(paths.absolutePdfPath, snapshot, input.claimPeriodStart, input.claimPeriodEnd, input.notes ?? '');

  return prisma.progressClaimReport.create({
    data: {
      userId,
      projectId: project.id,
      companySnapshotJson: JSON.stringify(snapshot.company),
      workerSnapshotJson: JSON.stringify(snapshot.worker),
      projectSnapshotJson: JSON.stringify(snapshot.project),
      claimPeriodStart: input.claimPeriodStart,
      claimPeriodEnd: input.claimPeriodEnd,
      totalDaysWorked,
      totalHours,
      totalOvertimeHours,
      totalClaimAmount: netPay,
      entriesSnapshotJson: JSON.stringify(snapshot.entries),
      photosSnapshotJson: JSON.stringify(snapshot.photos),
      pdfPath: paths.relativePdfPath,
      csvPath: paths.relativeCsvPath,
      notes: input.notes ?? ''
    }
  });
}

export async function getReportPdf(userId: string, reportId: string): Promise<ReportFileResult> {
  const report = await getReport(userId, reportId);
  return {
    report,
    absolutePath: resolveOwnedExportPath(report.pdfPath),
    fileName: `progress-claim-${report.id}.pdf`,
    contentType: 'application/pdf'
  };
}

export async function getReportCsv(userId: string, reportId: string): Promise<ReportFileResult> {
  const report = await getReport(userId, reportId);
  return {
    report,
    absolutePath: resolveOwnedExportPath(report.csvPath),
    fileName: `progress-claim-${report.id}.csv`,
    contentType: 'text/csv; charset=utf-8'
  };
}

export async function deleteReport(userId: string, reportId: string): Promise<void> {
  const report = await getReport(userId, reportId);
  await prisma.progressClaimReport.delete({ where: { id: report.id } });
  await Promise.all([removeExportFile(report.pdfPath), removeExportFile(report.csvPath)]);
}

export function openReportFile(file: ReportFileResult) {
  return createReadStream(file.absolutePath);
}

function buildCsv(snapshot: ProgressClaimSnapshot, claimPeriodStart: Date, claimPeriodEnd: Date): string {
  const rows: string[][] = [
    ['Report Title', 'Progress Claim Report'],
    ['Disclaimer', disclaimer],
    ['Worker', snapshot.worker.fullName ?? ''],
    ['Client/Company', snapshot.company?.name ?? ''],
    ['Project', snapshot.project.projectName],
    ['Claim Period', `${formatDateOnly(claimPeriodStart)} to ${formatDateOnly(claimPeriodEnd)}`],
    [],
    ['Date', 'Project', 'Work Description', 'Total Hours', 'OT Hours', 'Hourly Rate', 'OT Rate', 'Basic Amount', 'OT Amount', 'Evidence Filenames', 'Evidence Paths']
  ];

  for (const entry of snapshot.entries) {
    const entryPhotos = snapshot.photos.filter((photo) => photo.timeEntryId === entry.id || photo.date === entry.date);
    const regularHours = roundHours(Math.max(0, entry.totalHours - entry.overtimeHours));
    const basicAmount = roundMoney(regularHours * snapshot.totals.hourlyRate);
    const overtimeAmount = roundMoney(entry.overtimeHours * snapshot.totals.overtimeRate);
    rows.push([
      entry.date,
      snapshot.project.projectName,
      entry.workDescription,
      entry.totalHours.toString(),
      entry.overtimeHours.toString(),
      moneyToString(snapshot.totals.hourlyRate),
      moneyToString(snapshot.totals.overtimeRate),
      moneyToString(basicAmount),
      moneyToString(overtimeAmount),
      entryPhotos.map((photo) => photo.fileName).join('; '),
      entryPhotos.map((photo) => photo.imagePath).join('; ')
    ]);
  }

  rows.push(
    [],
    ['Total Days Worked', snapshot.totals.totalDaysWorked.toString()],
    ['Total Hours', snapshot.totals.totalHours.toString()],
    ['Total Overtime Hours', snapshot.totals.totalOvertimeHours.toString()],
    ['Basic Pay', moneyToString(snapshot.totals.basicPay)],
    ['OT Pay', moneyToString(snapshot.totals.overtimePay)],
    ['Allowances', moneyToString(snapshot.totals.allowances)],
    ['Rest Day Pay', moneyToString(snapshot.totals.restDayPay)],
    ['Public Holiday Pay', moneyToString(snapshot.totals.publicHolidayPay)],
    ['Deductions', moneyToString(snapshot.totals.deductions)],
    ['Gross Pay', moneyToString(snapshot.totals.grossPay)],
    ['Net Claim Amount', moneyToString(snapshot.totals.totalClaimAmount)]
  );

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

function writePdf(
  absolutePath: string,
  snapshot: ProgressClaimSnapshot,
  claimPeriodStart: Date,
  claimPeriodEnd: Date,
  notes: string
): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const document = new PDFDocument({ margin: 48, size: 'A4' });
    const stream = document.pipe(createWriteStream(absolutePath));

    stream.on('finish', resolvePromise);
    stream.on('error', rejectPromise);
    document.on('error', rejectPromise);

    document.fontSize(20).text('Progress Claim Report', { align: 'center' });
    document.moveDown(0.5);
    document.fontSize(9).text(disclaimer, { align: 'center' });
    document.moveDown();

    section(document, 'Worker');
    line(document, 'Name', snapshot.worker.fullName ?? '');
    line(document, 'Phone', snapshot.worker.phone ?? '');
    line(document, 'Worker ID', snapshot.worker.workerIdentifier ?? '');
    line(document, 'Trade', snapshot.worker.trade ?? '');

    section(document, 'Client / Company');
    line(document, 'Name', snapshot.company?.name ?? 'Not linked');
    line(document, 'UEN', snapshot.company?.uen ?? '');
    line(document, 'Contact', snapshot.company?.contactPerson ?? '');
    line(document, 'Address', snapshot.company?.address ?? '');

    section(document, 'Project');
    line(document, 'Project', snapshot.project.projectName);
    line(document, 'Site', snapshot.project.siteAddress);
    line(document, 'PO / Work Order', snapshot.project.poOrWorkOrderNumber ?? '');
    line(document, 'Claim Period', `${formatDateOnly(claimPeriodStart)} to ${formatDateOnly(claimPeriodEnd)}`);

    section(document, 'Totals');
    line(document, 'Days Worked', snapshot.totals.totalDaysWorked.toString());
    line(document, 'Total Hours', snapshot.totals.totalHours.toString());
    line(document, 'Overtime Hours', snapshot.totals.totalOvertimeHours.toString());
    line(document, 'Hourly Rate', moneyToString(snapshot.totals.hourlyRate));
    line(document, 'Overtime Rate', moneyToString(snapshot.totals.overtimeRate));
    line(document, 'Basic Pay', moneyToString(snapshot.totals.basicPay));
    line(document, 'OT Pay', moneyToString(snapshot.totals.overtimePay));
    line(document, 'Allowances', moneyToString(snapshot.totals.allowances));
    line(document, 'Deductions', moneyToString(snapshot.totals.deductions));
    line(document, 'Net Claim Amount', moneyToString(snapshot.totals.totalClaimAmount));

    section(document, 'Daily Work Log');
    for (const entry of snapshot.entries) {
      document.fontSize(10).text(`${entry.date} | ${entry.totalHours}h total | ${entry.overtimeHours}h OT`);
      document.fontSize(9).text(entry.workDescription);
      if (entry.notes) document.fontSize(9).text(`Notes: ${entry.notes}`);
      document.moveDown(0.35);
    }

    section(document, 'Photo Evidence');
    if (snapshot.photos.length === 0) {
      document.fontSize(9).text('No photo evidence in this period.');
    } else {
      for (const photo of snapshot.photos) {
        document.fontSize(9).text(`${photo.date} | ${photo.evidenceType} | ${photo.fileName} | ${photo.caption}`);
        document.fontSize(8).text(photo.imagePath);
      }
    }

    section(document, 'Rate Calculation');
    document.fontSize(9).text(
      `Basic pay = ${snapshot.totals.regularHours} regular hours x ${moneyToString(snapshot.totals.hourlyRate)}. ` +
        `OT pay = ${snapshot.totals.totalOvertimeHours} OT hours x ${moneyToString(snapshot.totals.overtimeRate)}.`
    );
    if (notes) {
      document.moveDown(0.5);
      document.text(`Notes: ${notes}`);
    }

    section(document, 'Signature');
    document.moveDown();
    document.text('Worker Signature: ________________________________');
    document.moveDown();
    document.text('Client / Company Acknowledgement: ________________');
    document.moveDown();
    document.text('Date: ____________________');

    document.end();
  });
}

async function prepareExportPaths(userId: string): Promise<{
  absolutePdfPath: string;
  absoluteCsvPath: string;
  relativePdfPath: string;
  relativeCsvPath: string;
}> {
  const exportRoot = getExportRoot();
  const userDir = join(exportRoot, userId);
  await mkdir(userDir, { recursive: true });
  const reportFileStem = `${Date.now()}-${randomUUID()}`;
  const absolutePdfPath = join(userDir, `${reportFileStem}.pdf`);
  const absoluteCsvPath = join(userDir, `${reportFileStem}.csv`);

  return {
    absolutePdfPath,
    absoluteCsvPath,
    relativePdfPath: relative(process.cwd(), absolutePdfPath).replaceAll('\\', '/'),
    relativeCsvPath: relative(process.cwd(), absoluteCsvPath).replaceAll('\\', '/')
  };
}

async function removeExportFile(filePath: string): Promise<void> {
  try {
    const absolutePath = resolveOwnedExportPath(filePath);
    await rm(absolutePath, { force: true });
  } catch (error) {
    if (error instanceof ReportServiceError) return;
    throw error;
  }
}

function resolveOwnedExportPath(filePath: string): string {
  const absolutePath = isAbsolute(filePath) ? resolve(filePath) : resolve(process.cwd(), filePath);
  if (!isPathWithinExportRoot(absolutePath)) {
    throw new ReportServiceError('Report file path is outside export storage', 500);
  }

  return absolutePath;
}

function isPathWithinExportRoot(filePath: string): boolean {
  const exportRoot = getExportRoot();
  const relativePath = relative(exportRoot, resolve(filePath));
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

function getExportRoot(): string {
  return resolve(process.env.EXPORT_ROOT ?? join(process.cwd(), 'src', 'exports'));
}

function validatePeriod(claimPeriodStart: Date, claimPeriodEnd: Date): void {
  if (!Number.isFinite(claimPeriodStart.getTime()) || !Number.isFinite(claimPeriodEnd.getTime())) {
    throw new ReportServiceError('Claim period dates must be valid', 400);
  }
  if (claimPeriodEnd < claimPeriodStart) {
    throw new ReportServiceError('claimPeriodEnd must be on or after claimPeriodStart', 400);
  }
}

function getDateOnlyPeriodBounds(claimPeriodStart: Date, claimPeriodEnd: Date): { queryStart: Date; queryEndExclusive: Date } {
  const queryStart = new Date(Date.UTC(
    claimPeriodStart.getUTCFullYear(),
    claimPeriodStart.getUTCMonth(),
    claimPeriodStart.getUTCDate()
  ));
  const queryEndExclusive = new Date(Date.UTC(
    claimPeriodEnd.getUTCFullYear(),
    claimPeriodEnd.getUTCMonth(),
    claimPeriodEnd.getUTCDate() + 1
  ));

  return { queryStart, queryEndExclusive };
}

function section(document: PDFKit.PDFDocument, title: string): void {
  document.moveDown();
  document.fontSize(13).text(title, { underline: true });
  document.moveDown(0.35);
}

function line(document: PDFKit.PDFDocument, label: string, value: string): void {
  document.fontSize(9).text(`${label}: ${value}`);
}

function csvCell(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function roundHours(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function moneyToString(value: number): string {
  return new Prisma.Decimal(value).toString();
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
