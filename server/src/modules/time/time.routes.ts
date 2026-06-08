import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../../middleware/requireUser.js';
import { nullableDate, requiredDate } from '../../utils/validation.js';
import {
  clockIn,
  clockOut,
  createManualEntry,
  deleteEntry,
  finalize,
  getEntry,
  listEntries,
  TimeEntryServiceError,
  updateEntry
} from './time.service.js';

const optionalText = z.string().trim().optional();
const gpsCoordinate = z.number().finite().nullable().optional();
const breakMinutes = z.number().int().min(0).optional().default(0);

const dateTime = z
  .string()
  .trim()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const manualEntrySchema = z.object({
  projectId: z.string().trim().min(1, 'projectId is required'),
  date: requiredDate.optional(),
  clockInTime: dateTime,
  clockOutTime: dateTime,
  breakMinutes,
  workDescription: optionalText.default(''),
  locationText: optionalText.default(''),
  clockInGpsLat: gpsCoordinate,
  clockInGpsLng: gpsCoordinate,
  clockOutGpsLat: gpsCoordinate,
  clockOutGpsLng: gpsCoordinate,
  notes: optionalText.default('')
});

const clockInSchema = z.object({
  projectId: z.string().trim().min(1, 'projectId is required'),
  date: nullableDate.optional().transform((value) => value ?? undefined),
  clockInTime: dateTime.optional(),
  workDescription: optionalText.default(''),
  locationText: optionalText.default(''),
  clockInGpsLat: gpsCoordinate,
  clockInGpsLng: gpsCoordinate,
  notes: optionalText.default('')
});

const clockOutSchema = z.object({
  clockOutTime: dateTime,
  breakMinutes,
  clockOutGpsLat: gpsCoordinate,
  clockOutGpsLng: gpsCoordinate,
  locationText: optionalText,
  workDescription: optionalText,
  notes: optionalText
});

const updateEntrySchema = z
  .object({
    projectId: z.string().trim().min(1).optional(),
    date: nullableDate.optional().transform((value) => value ?? undefined),
    clockInTime: dateTime.optional(),
    clockOutTime: dateTime.optional(),
    breakMinutes: z.number().int().min(0).optional(),
    workDescription: optionalText,
    locationText: optionalText,
    clockInGpsLat: gpsCoordinate,
    clockInGpsLng: gpsCoordinate,
    clockOutGpsLat: gpsCoordinate,
    clockOutGpsLng: gpsCoordinate,
    notes: optionalText
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one time entry field is required'
  });

export const timeRouter = Router();

timeRouter.use(requireUser);

timeRouter.get('/', async (req, res, next) => {
  try {
    const timeEntries = await listEntries(req.user!.id);
    res.json({ timeEntries });
  } catch (error) {
    next(error);
  }
});

timeRouter.post('/', async (req, res, next) => {
  try {
    const parsed = manualEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid time entry payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const timeEntry = await createManualEntry(req.user!.id, parsed.data);
    res.status(201).json({ timeEntry });
  } catch (error) {
    handleTimeEntryError(error, res, next);
  }
});

timeRouter.post('/clock-in', async (req, res, next) => {
  try {
    const parsed = clockInSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid clock-in payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const timeEntry = await clockIn(req.user!.id, parsed.data);
    res.status(201).json({ timeEntry });
  } catch (error) {
    handleTimeEntryError(error, res, next);
  }
});

timeRouter.get('/:id', async (req, res, next) => {
  try {
    const timeEntry = await getEntry(req.user!.id, req.params.id);
    res.json({ timeEntry });
  } catch (error) {
    handleTimeEntryError(error, res, next);
  }
});

timeRouter.put('/:id', async (req, res, next) => {
  try {
    const parsed = updateEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid time entry payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const timeEntry = await updateEntry(req.user!.id, req.params.id, parsed.data);
    res.json({ timeEntry });
  } catch (error) {
    handleTimeEntryError(error, res, next);
  }
});

timeRouter.delete('/:id', async (req, res, next) => {
  try {
    await deleteEntry(req.user!.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    handleTimeEntryError(error, res, next);
  }
});

timeRouter.post('/:id/clock-out', async (req, res, next) => {
  try {
    const parsed = clockOutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid clock-out payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const timeEntry = await clockOut(req.user!.id, req.params.id, parsed.data);
    res.json({ timeEntry });
  } catch (error) {
    handleTimeEntryError(error, res, next);
  }
});

timeRouter.post('/:id/finalize', async (req, res, next) => {
  try {
    const timeEntry = await finalize(req.user!.id, req.params.id);
    res.json({ timeEntry });
  } catch (error) {
    handleTimeEntryError(error, res, next);
  }
});

function handleTimeEntryError(error: unknown, res: Parameters<Parameters<typeof timeRouter.get>[1]>[1], next: (error: unknown) => void): void {
  if (error instanceof TimeEntryServiceError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
