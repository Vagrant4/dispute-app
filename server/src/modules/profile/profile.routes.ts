import { EmploymentType } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireUser } from '../../middleware/requireUser.js';
import { nullableMoney } from '../../utils/validation.js';

const profileSchema = z.object({
  fullName: z.string().trim().min(1, 'fullName is required'),
  phone: z.string().trim().min(1, 'phone is required'),
  workerIdentifier: z.string().trim().min(1).nullable().optional(),
  finNric: z.string().trim().min(1).nullable().optional(),
  trade: z.string().trim().min(1, 'trade is required'),
  employmentType: z.enum(EmploymentType),
  defaultHourlyRate: nullableMoney,
  defaultDailyRate: nullableMoney,
  defaultMonthlySalary: nullableMoney
});

export const profileRouter = Router();

profileRouter.use(requireUser);

profileRouter.get('/', async (req, res, next) => {
  try {
    const profile = await prisma.workerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    res.json({ profile });
  } catch (error) {
    next(error);
  }
});

profileRouter.put('/', async (req, res, next) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid profile payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const profile = await prisma.workerProfile.upsert({
      where: { userId: req.user!.id },
      create: {
        userId: req.user!.id,
        ...parsed.data
      },
      update: parsed.data
    });

    res.json({ profile });
  } catch (error) {
    next(error);
  }
});
