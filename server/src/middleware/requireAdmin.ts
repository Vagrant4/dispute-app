import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const email = user.email.trim().toLowerCase();
  const roleAllowed = user.role === 'ADMIN' || user.role === 'ADMIN_PLACEHOLDER';
  const emailAllowed = env.adminEmails.includes(email);

  if (!roleAllowed && !emailAllowed) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}
