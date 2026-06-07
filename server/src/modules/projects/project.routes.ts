import { ProjectStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireUser } from '../../middleware/requireUser.js';

const nullableMoney = z.union([z.number().nonnegative(), z.string().trim().min(1), z.null()]).optional();
const nullableText = z.string().trim().min(1).nullable().optional();
const nullableDate = z
  .string()
  .trim()
  .min(1)
  .datetime({ offset: true })
  .or(z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/))
  .nullable()
  .optional()
  .transform((value) => (value ? new Date(value) : null));
const requiredDate = z
  .string()
  .trim()
  .min(1, 'startDate is required')
  .datetime({ offset: true })
  .or(z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/))
  .transform((value) => new Date(value));

const projectSchema = z.object({
  companyId: nullableText,
  projectName: z.string().trim().min(1, 'projectName is required'),
  siteAddress: z.string().trim().min(1, 'siteAddress is required'),
  poOrWorkOrderNumber: nullableText,
  startDate: requiredDate,
  endDate: nullableDate,
  description: z.string().trim().optional().default(''),
  defaultHourlyRate: nullableMoney,
  defaultDailyRate: nullableMoney,
  status: z.enum(ProjectStatus).optional().default(ProjectStatus.ACTIVE)
});

const projectUpdateSchema = projectSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one project field is required'
});

export const projectRouter = Router();

projectRouter.use(requireUser);

projectRouter.get('/', async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

projectRouter.post('/', async (req, res, next) => {
  try {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid project payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const canUseCompany = await verifyCompanyOwnership(req.user!.id, parsed.data.companyId);
    if (!canUseCompany) {
      res.status(403).json({ error: 'Company does not belong to the current user' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        userId: req.user!.id,
        ...parsed.data
      }
    });

    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

projectRouter.get('/:id', async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user!.id }
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

projectRouter.put('/:id', async (req, res, next) => {
  try {
    const parsed = projectUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid project payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const existingProject = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user!.id }
    });
    if (!existingProject) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if ('companyId' in parsed.data) {
      const canUseCompany = await verifyCompanyOwnership(req.user!.id, parsed.data.companyId);
      if (!canUseCompany) {
        res.status(403).json({ error: 'Company does not belong to the current user' });
        return;
      }
    }

    const project = await prisma.project.update({
      where: { id: existingProject.id },
      data: parsed.data
    });

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

projectRouter.delete('/:id', async (req, res, next) => {
  try {
    const existingProject = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user!.id }
    });
    if (!existingProject) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    await prisma.project.delete({ where: { id: existingProject.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

async function verifyCompanyOwnership(userId: string, companyId: string | null | undefined): Promise<boolean> {
  if (!companyId) return true;

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId },
    select: { id: true }
  });

  return Boolean(company);
}
