import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function date(value: string): Date {
  return new Date(value);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? '';

  if (!databaseUrl.startsWith('file:')) {
    console.log('Skipping demo seed because DATABASE_URL is not a local SQLite file URL.');
    return;
  }

  const passwordHash = await bcrypt.hash('Password123!', 10);

  await prisma.user.upsert({
    where: { email: 'demo@claimproof.sg' },
    update: {
      passwordHash,
      role: 'WORKER',
      status: 'ACTIVE',
    },
    create: {
      email: 'demo@claimproof.sg',
      passwordHash,
      role: 'WORKER',
      status: 'ACTIVE',
    },
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: 'demo@claimproof.sg' },
  });

  await prisma.progressClaimReport.deleteMany({ where: { userId: user.id } });
  await prisma.paySummary.deleteMany({ where: { userId: user.id } });
  await prisma.photoEvidence.deleteMany({ where: { userId: user.id } });
  await prisma.timeEntry.deleteMany({ where: { userId: user.id } });
  await prisma.project.deleteMany({ where: { userId: user.id } });
  await prisma.company.deleteMany({ where: { userId: user.id } });
  await prisma.workerProfile.deleteMany({ where: { userId: user.id } });
  await prisma.appSetting.deleteMany({ where: { userId: user.id } });

  const profile = await prisma.workerProfile.create({
    data: {
      userId: user.id,
      fullName: 'Demo Freelancer',
      phone: '+65 8123 4567',
      workerIdentifier: 'DEMO-FREELANCER-001',
      finNric: null,
      trade: 'Steel / Site Works',
      employmentType: 'FREELANCER',
      defaultHourlyRate: '25.00',
      defaultDailyRate: null,
      defaultMonthlySalary: null,
    },
  });

  await prisma.appSetting.create({
    data: {
      userId: user.id,
      standardDailyHours: 8,
      standardWeeklyHours: 44,
      overtimeMultiplier: 1.5,
      defaultCurrency: 'SGD',
    },
  });

  const company = await prisma.company.create({
    data: {
      userId: user.id,
      name: 'ABC Construction Pte Ltd',
      uen: '202612345A',
      contactPerson: 'Tan Wei Ming',
      email: 'operations@abc-construction.example',
      phone: '+65 6777 1234',
      address: '10 Jurong Industrial Estate, Singapore 629000',
      notes: 'Demo client company for progress claim evidence.',
    },
  });

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      companyId: company.id,
      projectName: 'Steel Bracket Installation',
      siteAddress: 'Jurong, Singapore',
      poOrWorkOrderNumber: 'WO-CP-2026-001',
      startDate: date('2026-06-01T00:00:00+08:00'),
      endDate: null,
      description: 'Install and align steel brackets for site works package.',
      defaultHourlyRate: '25.00',
      defaultDailyRate: null,
      status: 'ACTIVE',
    },
  });

  const entries = [
    {
      date: '2026-06-01T00:00:00+08:00',
      clockInTime: '2026-06-01T08:00:00+08:00',
      clockOutTime: '2026-06-01T17:00:00+08:00',
      breakMinutes: 60,
      totalHours: 8,
      overtimeHours: 0,
      workDescription: 'Set out bracket positions and prepare mounting points.',
      locationText: 'Jurong, Singapore',
      clockInGpsLat: 1.3329,
      clockInGpsLng: 103.7436,
      clockOutGpsLat: 1.3332,
      clockOutGpsLng: 103.7439,
    },
    {
      date: '2026-06-02T00:00:00+08:00',
      clockInTime: '2026-06-02T08:00:00+08:00',
      clockOutTime: '2026-06-02T18:00:00+08:00',
      breakMinutes: 60,
      totalHours: 9,
      overtimeHours: 1,
      workDescription: 'Install first batch of steel brackets and verify alignment.',
      locationText: 'Jurong, Singapore',
      clockInGpsLat: 1.333,
      clockInGpsLng: 103.7438,
      clockOutGpsLat: 1.3334,
      clockOutGpsLng: 103.744,
    },
    {
      date: '2026-06-03T00:00:00+08:00',
      clockInTime: '2026-06-03T08:30:00+08:00',
      clockOutTime: '2026-06-03T17:30:00+08:00',
      breakMinutes: 45,
      totalHours: 8.25,
      overtimeHours: 0.25,
      workDescription: 'Continue bracket installation at level two access area.',
      locationText: 'Jurong, Singapore',
      clockInGpsLat: null,
      clockInGpsLng: null,
      clockOutGpsLat: null,
      clockOutGpsLng: null,
    },
    {
      date: '2026-06-04T00:00:00+08:00',
      clockInTime: '2026-06-04T08:00:00+08:00',
      clockOutTime: '2026-06-04T16:30:00+08:00',
      breakMinutes: 30,
      totalHours: 8,
      overtimeHours: 0,
      workDescription: 'Rectify bracket spacing and document variation work area.',
      locationText: 'Jurong, Singapore',
      clockInGpsLat: 1.3331,
      clockInGpsLng: 103.7437,
      clockOutGpsLat: 1.3333,
      clockOutGpsLng: 103.7438,
    },
    {
      date: '2026-06-05T00:00:00+08:00',
      clockInTime: '2026-06-05T08:00:00+08:00',
      clockOutTime: '2026-06-05T18:30:00+08:00',
      breakMinutes: 60,
      totalHours: 9.5,
      overtimeHours: 1.5,
      workDescription: 'Complete installation run and prepare handover evidence.',
      locationText: 'Jurong, Singapore',
      clockInGpsLat: 1.333,
      clockInGpsLng: 103.7436,
      clockOutGpsLat: 1.3335,
      clockOutGpsLng: 103.7441,
    },
  ];

  const timeEntries = await Promise.all(
    entries.map((entry) =>
      prisma.timeEntry.create({
        data: {
          userId: user.id,
          projectId: project.id,
          date: date(entry.date),
          clockInTime: date(entry.clockInTime),
          clockOutTime: date(entry.clockOutTime),
          breakMinutes: entry.breakMinutes,
          totalHours: entry.totalHours,
          overtimeHours: entry.overtimeHours,
          workDescription: entry.workDescription,
          manualEntryFlag: true,
          locationText: entry.locationText,
          clockInGpsLat: entry.clockInGpsLat,
          clockInGpsLng: entry.clockInGpsLng,
          clockOutGpsLat: entry.clockOutGpsLat,
          clockOutGpsLng: entry.clockOutGpsLng,
          status: 'FINALIZED',
          notes: 'Seeded demo entry with inclusive break deducted from on-site duration.',
        },
      }),
    ),
  );

  const photos = await Promise.all(
    [
      ['uploads/demo/before-bracket-area.jpg', 'Before work: bracket installation area.', 'BEFORE_WORK', 0],
      ['uploads/demo/material-delivery.jpg', 'Material delivery evidence for steel brackets.', 'MATERIAL_DELIVERY', 0],
      ['uploads/demo/during-installation-1.jpg', 'During work: first bracket alignment.', 'DURING_WORK', 1],
      ['uploads/demo/during-installation-2.jpg', 'During work: level two bracket fixing.', 'DURING_WORK', 2],
      ['uploads/demo/variation-spacing.jpg', 'Variation work: bracket spacing rectification.', 'VARIATION_WORK', 3],
      ['uploads/demo/completed-brackets.jpg', 'Completed work: final bracket run.', 'COMPLETED_WORK', 4],
    ].map(([imagePath, caption, evidenceType, entryIndex], index) =>
      prisma.photoEvidence.create({
        data: {
          userId: user.id,
          projectId: project.id,
          timeEntryId: timeEntries[Number(entryIndex)].id,
          imagePath: String(imagePath),
          caption: String(caption),
          evidenceType: evidenceType as 'BEFORE_WORK' | 'DURING_WORK' | 'COMPLETED_WORK' | 'MATERIAL_DELIVERY' | 'VARIATION_WORK',
          timestamp: date(`2026-06-0${Math.min(index + 1, 5)}T12:00:00+08:00`),
          gpsLat: 1.333 + index * 0.0001,
          gpsLng: 103.7436 + index * 0.0001,
        },
      }),
    ),
  );

  const totalHours = timeEntries.reduce((sum, entry) => sum + entry.totalHours, 0);
  const totalOvertimeHours = timeEntries.reduce((sum, entry) => sum + entry.overtimeHours, 0);
  const regularHours = totalHours - totalOvertimeHours;
  const basicPay = regularHours * 25;
  const overtimeRate = 37.5;
  const overtimePay = totalOvertimeHours * overtimeRate;
  const totalAllowances = 50;
  const totalDeductions = 0;
  const grossPay = basicPay + overtimePay + totalAllowances;
  const netPay = grossPay - totalDeductions;

  const paySummary = await prisma.paySummary.create({
    data: {
      userId: user.id,
      projectId: project.id,
      salaryPeriodStart: date('2026-06-01T00:00:00+08:00'),
      salaryPeriodEnd: date('2026-06-05T23:59:59+08:00'),
      rateType: 'HOURLY',
      basicRate: '25.00',
      basicPay: basicPay.toFixed(2),
      overtimeRate: overtimeRate.toFixed(2),
      overtimePay: overtimePay.toFixed(2),
      restDayPay: '0.00',
      publicHolidayPay: '0.00',
      totalAllowances: totalAllowances.toFixed(2),
      totalDeductions: totalDeductions.toFixed(2),
      grossPay: grossPay.toFixed(2),
      netPay: netPay.toFixed(2),
      itemisedPayslipJson: JSON.stringify({
        workerName: profile.fullName,
        clientCompanyName: company.name,
        paymentDate: '2026-06-07',
        salaryPeriodStart: '2026-06-01',
        salaryPeriodEnd: '2026-06-05',
        basicPay: basicPay.toFixed(2),
        allowances: [{ description: 'Transport allowance', amount: totalAllowances.toFixed(2) }],
        deductions: [],
        overtimeHours: totalOvertimeHours,
        overtimePay: overtimePay.toFixed(2),
        grossPay: grossPay.toFixed(2),
        netPay: netPay.toFixed(2),
        notes: 'Demo payslip JSON for ClaimProof SG V1.',
      }),
      notes: 'Seeded demo pay summary for Steel Bracket Installation.',
      allowances: {
        create: [{ description: 'Transport allowance', amount: totalAllowances.toFixed(2) }],
      },
      deductions: {
        create: [],
      },
    },
  });

  await prisma.progressClaimReport.create({
    data: {
      userId: user.id,
      projectId: project.id,
      companySnapshotJson: JSON.stringify({
        id: company.id,
        name: company.name,
        uen: company.uen,
        contactPerson: company.contactPerson,
        email: company.email,
        phone: company.phone,
        address: company.address,
      }),
      workerSnapshotJson: JSON.stringify({
        id: profile.id,
        fullName: profile.fullName,
        phone: profile.phone,
        trade: profile.trade,
        employmentType: profile.employmentType,
        defaultHourlyRate: '25.00',
      }),
      projectSnapshotJson: JSON.stringify({
        id: project.id,
        projectName: project.projectName,
        siteAddress: project.siteAddress,
        poOrWorkOrderNumber: project.poOrWorkOrderNumber,
        description: project.description,
        defaultHourlyRate: '25.00',
      }),
      claimPeriodStart: date('2026-06-01T00:00:00+08:00'),
      claimPeriodEnd: date('2026-06-05T23:59:59+08:00'),
      totalDaysWorked: timeEntries.length,
      totalHours,
      totalOvertimeHours,
      totalClaimAmount: paySummary.grossPay,
      entriesSnapshotJson: JSON.stringify(timeEntries.map((entry) => ({
        id: entry.id,
        date: entry.date.toISOString(),
        clockInTime: entry.clockInTime.toISOString(),
        clockOutTime: entry.clockOutTime.toISOString(),
        breakMinutes: entry.breakMinutes,
        totalHours: entry.totalHours,
        overtimeHours: entry.overtimeHours,
        workDescription: entry.workDescription,
        locationText: entry.locationText,
        manualEntryFlag: entry.manualEntryFlag,
      }))),
      photosSnapshotJson: JSON.stringify(photos.map((photo) => ({
        id: photo.id,
        timeEntryId: photo.timeEntryId,
        imagePath: photo.imagePath,
        caption: photo.caption,
        evidenceType: photo.evidenceType,
        timestamp: photo.timestamp.toISOString(),
        gpsLat: photo.gpsLat,
        gpsLng: photo.gpsLng,
      }))),
      pdfPath: 'exports/demo/steel-bracket-installation-progress-claim.pdf',
      csvPath: 'exports/demo/steel-bracket-installation-progress-claim.csv',
      notes: 'Seeded progress claim report with stable snapshot JSON.',
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { id: 'placeholder-free' },
    update: {
      name: 'Free Placeholder',
      price: '0.00',
      limitsJson: JSON.stringify({ reportsPerMonth: 3, photoEvidence: 'local-placeholder' }),
      status: 'PLACEHOLDER',
    },
    create: {
      id: 'placeholder-free',
      name: 'Free Placeholder',
      price: '0.00',
      limitsJson: JSON.stringify({ reportsPerMonth: 3, photoEvidence: 'local-placeholder' }),
      status: 'PLACEHOLDER',
    },
  });

  console.log('Seeded demo@claimproof.sg with ClaimProof SG demo data.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
