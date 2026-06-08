import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireUser } from '../../middleware/requireUser.js';
import { requiredDateOnly, requiredMoney } from '../../utils/validation.js';
import {
  deleteReport,
  generateProgressClaimReport,
  getReport,
  getReportCsv,
  getReportPdf,
  listReports,
  openReportFile,
  ReportServiceError
} from './report.service.js';

const generateReportSchema = z
  .object({
    projectId: z.string().trim().min(1),
    claimPeriodStart: requiredDateOnly,
    claimPeriodEnd: requiredDateOnly,
    hourlyRate: requiredMoney.optional(),
    overtimeRate: requiredMoney.optional(),
    allowances: requiredMoney.optional().default(0),
    deductions: requiredMoney.optional().default(0),
    restDayPay: requiredMoney.optional().default(0),
    publicHolidayPay: requiredMoney.optional().default(0),
    notes: z.string().trim().optional().default('')
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.claimPeriodEnd < data.claimPeriodStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['claimPeriodEnd'],
        message: 'claimPeriodEnd must be on or after claimPeriodStart'
      });
    }
  });

export const reportRouter = Router();

reportRouter.use(requireUser);

reportRouter.get('/', async (req, res, next) => {
  try {
    const reports = await listReports(req.user!.id);
    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

reportRouter.post('/progress-claim', async (req, res, next) => {
  try {
    const parsed = generateReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid report payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const report = await generateProgressClaimReport(req.user!.id, parsed.data);
    res.status(201).json({ report });
  } catch (error) {
    handleReportError(error, res, next);
  }
});

reportRouter.get('/:id', async (req, res, next) => {
  try {
    const report = await getReport(req.user!.id, req.params.id);
    res.json({ report });
  } catch (error) {
    handleReportError(error, res, next);
  }
});

reportRouter.get('/:id/pdf', async (req, res, next) => {
  try {
    const file = await getReportPdf(req.user!.id, req.params.id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    openReportFile(file).on('error', next).pipe(res);
  } catch (error) {
    handleReportError(error, res, next);
  }
});

reportRouter.get('/:id/csv', async (req, res, next) => {
  try {
    const file = await getReportCsv(req.user!.id, req.params.id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    openReportFile(file).on('error', next).pipe(res);
  } catch (error) {
    handleReportError(error, res, next);
  }
});

reportRouter.delete('/:id', async (req, res, next) => {
  try {
    await deleteReport(req.user!.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    handleReportError(error, res, next);
  }
});

function handleReportError(error: unknown, res: Response, next: (error: unknown) => void): void {
  if (error instanceof ReportServiceError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
