import type { NextFunction, Request, Response } from 'express';
import { UserStatus } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { getAuthUserFromRequest, type AuthUser } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tokenUser = getAuthUserFromRequest(req);
  if (!tokenUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: tokenUser.id } });
  if (!user || user.status !== UserStatus.ACTIVE) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role
  };
  next();
}
