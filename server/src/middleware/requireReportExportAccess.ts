import type { NextFunction, Request, Response } from 'express';
import { getSubscriptionEntitlement } from '../modules/subscription/subscription.service.js';

export async function requireReportExportAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entitlement = await getSubscriptionEntitlement(req.user!.id);
    if (!entitlement.canExportReports) {
      res.status(402).json({
        error: 'An active DISPUTE trial or subscription is required to export reports.',
        subscription: entitlement
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
