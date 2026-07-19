import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireUser } from '../../middleware/requireUser.js';

const settingsSchema = z
  .object({
    standardDailyHours: z.number().finite().min(1).max(24),
    standardWeeklyHours: z.number().finite().min(1).max(168),
    overtimeMultiplier: z.number().finite().min(1).max(5),
    defaultCurrency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, 'defaultCurrency must be a 3-letter currency code')
      .transform((value) => value.toUpperCase())
  })
  .strict()
  .refine((settings) => settings.standardWeeklyHours >= settings.standardDailyHours, {
    message: 'standardWeeklyHours must be greater than or equal to standardDailyHours',
    path: ['standardWeeklyHours']
  });

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
