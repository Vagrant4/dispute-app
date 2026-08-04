import type { NextFunction, Request, Response } from 'express';
import { getSubscriptionEntitlement } from '../modules/subscription/subscription.service.js';

export async function requireRecordMutationAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || isClockOutCompletion(req)) {
    next();
    return;
  }

  try {
    const entitlement = await getSubscriptionEntitlement(req.user!.id);
    if (!entitlement.canCreateRecords) {
      res.status(402).json({
        error: 'An active DISPUTE trial, subscription or fulfilled referral reward is required to create or change work records.',
        subscription: entitlement
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

function isClockOutCompletion(req: Request): boolean {
  return req.method === 'POST' && /\/clock-out\/?$/.test(req.path);
}
