import { RateType } from '@prisma/client';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireUser } from '../../middleware/requireUser.js';
import { requiredDate, requiredMoney } from '../../utils/validation.js';
import {
  deletePaySummary,
  generatePaySummary,
  getPaySummary,
  listPaySummaries,
  PaySummaryServiceError
} from './pay.service.js';

const optionalText = z.string().trim().optional();

const lineItemSchema = z.object({
  description: z.string().trim().min(1, 'description is required'),
  amount: requiredMoney
});

const generatePaySummarySchema = z
  .object({
    projectId: z.string().trim().min(1).nullable().optional(),
    salaryPeriodStart: requiredDate,
    salaryPeriodEnd: requiredDate,
    rateType: z.enum(RateType),
    basicRate: requiredMoney,
    overtimeRate: requiredMoney.optional(),
    restDayPay: requiredMoney.optional().default(0),
    publicHolidayPay: requiredMoney.optional().default(0),
    allowances: z.array(lineItemSchema).optional().default([]),
    deductions: z.array(lineItemSchema).optional().default([]),
    notes: optionalText.default('')
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.salaryPeriodEnd < data.salaryPeriodStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['salaryPeriodEnd'],
        message: 'salaryPeriodEnd must be on or after salaryPeriodStart'
      });
    }
  });

export const payRouter = Router();

payRouter.use(requireUser);

payRouter.get('/', async (req, res, next) => {
  try {
    const paySummaries = await listPaySummaries(req.user!.id);
    res.json({ paySummaries });
  } catch (error) {
    next(error);
  }
});

payRouter.post('/generate', async (req, res, next) => {
  try {
    const parsed = generatePaySummarySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid pay summary payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const paySummary = await generatePaySummary(req.user!.id, parsed.data);
    res.status(201).json({ paySummary });
  } catch (error) {
    handlePaySummaryError(error, res, next);
  }
});

payRouter.get('/:id', async (req, res, next) => {
  try {
    const paySummary = await getPaySummary(req.user!.id, req.params.id);
    res.json({ paySummary });
  } catch (error) {
    handlePaySummaryError(error, res, next);
  }
});

payRouter.delete('/:id', async (req, res, next) => {
  try {
    await deletePaySummary(req.user!.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    handlePaySummaryError(error, res, next);
  }
});

function handlePaySummaryError(error: unknown, res: Response, next: (error: unknown) => void): void {
  if (error instanceof PaySummaryServiceError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
