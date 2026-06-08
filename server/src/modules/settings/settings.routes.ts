import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireUser } from '../../middleware/requireUser.js';

const positiveNumber = z.number().finite().positive();

const settingsSchema = z
  .object({
    standardDailyHours: positiveNumber,
    standardWeeklyHours: positiveNumber,
    overtimeMultiplier: positiveNumber,
    defaultCurrency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, 'defaultCurrency must be a 3-letter currency code')
      .transform((value) => value.toUpperCase())
  })
  .strict();

export const settingsRouter = Router();

settingsRouter.use(requireUser);

settingsRouter.get('/', async (req, res, next) => {
  try {
    const settings = await prisma.appSetting.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id },
      update: {}
    });

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put('/', async (req, res, next) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid settings payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const settings = await prisma.appSetting.upsert({
      where: { userId: req.user!.id },
      create: {
        userId: req.user!.id,
        ...parsed.data
      },
      update: parsed.data
    });

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});
