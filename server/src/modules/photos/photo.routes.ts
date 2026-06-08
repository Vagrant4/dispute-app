import { mkdir, rm } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EvidenceType } from '@prisma/client';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { requireUser } from '../../middleware/requireUser.js';

const maxUploadBytes = 10 * 1024 * 1024;
const acceptedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const uploadRoot = resolve(env.uploadRoot);

class InvalidPhotoUploadError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

const storage = multer.diskStorage({
  async destination(req, _file, callback) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        callback(new Error('Authentication required'), '');
        return;
      }

      const userUploadDir = join(uploadRoot, userId);
      await mkdir(userUploadDir, { recursive: true });
      callback(null, userUploadDir);
    } catch (error) {
      callback(error instanceof Error ? error : new Error('Unable to prepare upload directory'), '');
    }
  },
  filename(_req, file, callback) {
    const extension = sanitizeExtension(extname(file.originalname));
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: maxUploadBytes },
  fileFilter(_req, file, callback) {
    if (!acceptedImageMimeTypes.has(file.mimetype)) {
      callback(new InvalidPhotoUploadError('Photo evidence file must be a JPEG, PNG, WebP, HEIC, or HEIF image', 400));
      return;
    }

    callback(null, true);
  }
});

const optionalText = z.string().trim().optional().default('');
const idField = z.string().trim().min(1);
const optionalIdField = z
  .string()
  .trim()
  .min(1)
  .optional()
  .transform((value) => value || undefined);
const optionalGps = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'string') return Number(value);
  return value;
}, z.number().finite().nullable().optional());
const optionalTimestamp = z
  .string()
  .trim()
  .datetime({ offset: true })
  .optional()
  .transform((value) => (value ? new Date(value) : new Date()));

const uploadMetadataSchema = z.object({
  projectId: idField,
  timeEntryId: optionalIdField,
  caption: optionalText,
  evidenceType: z.enum(EvidenceType),
  timestamp: optionalTimestamp,
  gpsLat: optionalGps,
  gpsLng: optionalGps
});

const updateSchema = z
  .object({
    projectId: idField.optional(),
    timeEntryId: z.string().trim().min(1).nullable().optional(),
    caption: z.string().trim().optional(),
    evidenceType: z.enum(EvidenceType).optional(),
    timestamp: z
      .string()
      .trim()
      .datetime({ offset: true })
      .optional()
      .transform((value) => (value ? new Date(value) : undefined)),
    gpsLat: optionalGps,
    gpsLng: optionalGps
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one photo evidence field is required'
  });

export const photoRouter = Router();

photoRouter.use(requireUser);

photoRouter.get('/', async (req, res, next) => {
  try {
    const photoEvidence = await prisma.photoEvidence.findMany({
      where: { userId: req.user!.id },
      orderBy: { timestamp: 'desc' }
    });

    res.json({ photoEvidence });
  } catch (error) {
    next(error);
  }
});

photoRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Photo evidence file is required' });
      return;
    }

    const parsed = uploadMetadataSchema.safeParse(req.body);
    if (!parsed.success) {
      await removeUploadedFile(req.file.path);
      res.status(400).json({ error: 'Invalid photo evidence payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const canLink = await verifyProjectAndTimeEntry(req.user!.id, parsed.data.projectId, parsed.data.timeEntryId);
    if (!canLink) {
      await removeUploadedFile(req.file.path);
      res.status(403).json({ error: 'Project or time entry does not belong to the current user' });
      return;
    }

    const photoEvidence = await prisma.photoEvidence.create({
      data: {
        userId: req.user!.id,
        projectId: parsed.data.projectId,
        timeEntryId: parsed.data.timeEntryId,
        imagePath: toRelativeUploadPath(req.file.path),
        caption: parsed.data.caption,
        evidenceType: parsed.data.evidenceType,
        timestamp: parsed.data.timestamp,
        gpsLat: parsed.data.gpsLat,
        gpsLng: parsed.data.gpsLng
      }
    });

    res.status(201).json({ photoEvidence });
  } catch (error) {
    if (req.file) {
      await removeUploadedFile(req.file.path);
    }
    next(error);
  }
});

photoRouter.get('/:id', async (req, res, next) => {
  try {
    const photoEvidence = await getOwnedPhotoEvidence(req.user!.id, req.params.id);
    if (!photoEvidence) {
      res.status(404).json({ error: 'Photo evidence not found' });
      return;
    }

    res.json({ photoEvidence });
  } catch (error) {
    next(error);
  }
});

photoRouter.put('/:id', async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid photo evidence payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const existingPhotoEvidence = await getOwnedPhotoEvidence(req.user!.id, req.params.id);
    if (!existingPhotoEvidence) {
      res.status(404).json({ error: 'Photo evidence not found' });
      return;
    }

    const projectId = parsed.data.projectId ?? existingPhotoEvidence.projectId;
    const timeEntryId = parsed.data.timeEntryId === undefined ? existingPhotoEvidence.timeEntryId : parsed.data.timeEntryId;
    const canLink = await verifyProjectAndTimeEntry(req.user!.id, projectId, timeEntryId ?? undefined);
    if (!canLink) {
      res.status(403).json({ error: 'Project or time entry does not belong to the current user' });
      return;
    }

    const photoEvidence = await prisma.photoEvidence.update({
      where: { id: existingPhotoEvidence.id },
      data: {
        projectId: parsed.data.projectId,
        timeEntryId: parsed.data.timeEntryId,
        caption: parsed.data.caption,
        evidenceType: parsed.data.evidenceType,
        timestamp: parsed.data.timestamp,
        gpsLat: parsed.data.gpsLat,
        gpsLng: parsed.data.gpsLng
      }
    });

    res.json({ photoEvidence });
  } catch (error) {
    next(error);
  }
});

photoRouter.delete('/:id', async (req, res, next) => {
  try {
    const existingPhotoEvidence = await getOwnedPhotoEvidence(req.user!.id, req.params.id);
    if (!existingPhotoEvidence) {
      res.status(404).json({ error: 'Photo evidence not found' });
      return;
    }

    await prisma.photoEvidence.delete({ where: { id: existingPhotoEvidence.id } });
    await removeStoredPhotoFile(existingPhotoEvidence.imagePath);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

photoRouter.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof InvalidPhotoUploadError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: `Photo evidence file must be ${maxUploadBytes / 1024 / 1024} MB or smaller` });
      return;
    }

    res.status(400).json({ error: error.message });
    return;
  }

  next(error);
});

async function getOwnedPhotoEvidence(userId: string, id: string) {
  return prisma.photoEvidence.findFirst({
    where: { id, userId }
  });
}

async function verifyProjectAndTimeEntry(userId: string, projectId: string, timeEntryId?: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true }
  });
  if (!project) return false;

  if (!timeEntryId) return true;

  const timeEntry = await prisma.timeEntry.findFirst({
    where: { id: timeEntryId, projectId, userId },
    select: { id: true }
  });

  return Boolean(timeEntry);
}

function toRelativeUploadPath(filePath: string): string {
  return relative(process.cwd(), filePath).replaceAll('\\', '/');
}

async function removeStoredPhotoFile(imagePath: string): Promise<void> {
  const filePath = isAbsolute(imagePath) ? imagePath : resolve(process.cwd(), imagePath);
  if (!isPathWithinUploadRoot(filePath)) return;
  await removeUploadedFile(filePath);
}

async function removeUploadedFile(filePath: string): Promise<void> {
  if (!isPathWithinUploadRoot(filePath)) return;
  await rm(filePath, { force: true });
}

function sanitizeExtension(extension: string): string {
  const cleaned = extension.toLowerCase().replace(/[^a-z0-9.]/g, '');
  return cleaned.length > 0 && cleaned.length <= 12 ? cleaned : '';
}

function isPathWithinUploadRoot(filePath: string): boolean {
  const resolvedFilePath = resolve(filePath);
  const uploadRootRelativePath = relative(uploadRoot, resolvedFilePath);
  return uploadRootRelativePath !== '' && !uploadRootRelativePath.startsWith('..') && !isAbsolute(uploadRootRelativePath);
}
