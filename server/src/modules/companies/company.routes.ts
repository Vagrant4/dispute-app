import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireUser } from '../../middleware/requireUser.js';

const companySchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  uen: z.string().trim().min(1).nullable().optional(),
  contactPerson: z.string().trim().min(1, 'contactPerson is required'),
  email: z.string().trim().email('email must be valid'),
  phone: z.string().trim().min(1, 'phone is required'),
  address: z.string().trim().min(1, 'address is required'),
  notes: z.string().trim().optional().default('')
});

const companyUpdateSchema = companySchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one company field is required'
});

export const companyRouter = Router();

companyRouter.use(requireUser);

companyRouter.get('/', async (req, res, next) => {
  try {
    const companies = await prisma.company.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ companies });
  } catch (error) {
    next(error);
  }
});

companyRouter.post('/', async (req, res, next) => {
  try {
    const parsed = companySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid company payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const company = await prisma.company.create({
      data: {
        userId: req.user!.id,
        ...parsed.data
      }
    });

    res.status(201).json({ company });
  } catch (error) {
    next(error);
  }
});

companyRouter.get('/:id', async (req, res, next) => {
  try {
    const company = await prisma.company.findFirst({
      where: { id: req.params.id, userId: req.user!.id }
    });
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    res.json({ company });
  } catch (error) {
    next(error);
  }
});

companyRouter.put('/:id', async (req, res, next) => {
  try {
    const parsed = companyUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid company payload', issues: parsed.error.flatten().fieldErrors });
      return;
    }

    const existingCompany = await prisma.company.findFirst({
      where: { id: req.params.id, userId: req.user!.id }
    });
    if (!existingCompany) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const company = await prisma.company.update({
      where: { id: existingCompany.id },
      data: parsed.data
    });

    res.json({ company });
  } catch (error) {
    next(error);
  }
});

companyRouter.delete('/:id', async (req, res, next) => {
  try {
    const existingCompany = await prisma.company.findFirst({
      where: { id: req.params.id, userId: req.user!.id }
    });
    if (!existingCompany) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    await prisma.company.delete({ where: { id: existingCompany.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
