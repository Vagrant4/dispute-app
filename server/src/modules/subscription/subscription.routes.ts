import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { requireUser } from '../../middleware/requireUser.js';
import {
  getMobileStoreCheckoutResponse,
  getSubscriptionEntitlement,
  syncSubscriptionFromRevenueCat,
  updateSubscriptionFromRevenueCatWebhook
} from './subscription.service.js';

export const subscriptionRouter = Router();

const subscriptionSyncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user!.id,
  message: {
    error: 'Too many subscription verification attempts. Wait 15 minutes and try again.'
  }
});

subscriptionRouter.get('/status', requireUser, async (req, res, next) => {
  try {
    res.json({ subscription: await getSubscriptionEntitlement(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

subscriptionRouter.post('/create-checkout-session', requireUser, (_req, res) => {
  const response = getMobileStoreCheckoutResponse();
  res.status(response.statusCode).json(response.body);
});

subscriptionRouter.post('/sync', requireUser, subscriptionSyncLimiter, async (req, res, next) => {
  try {
    const response = await syncSubscriptionFromRevenueCat(req.user!.id);
    res.status(response.statusCode).json(response.body);
  } catch (error) {
    next(error);
  }
});

subscriptionRouter.post('/webhook', async (req, res, next) => {
  try {
    if (
      env.nodeEnv === 'production' &&
      (!env.revenueCat.webhookSecret ||
        !env.revenueCat.productId ||
        !env.revenueCat.entitlementId)
    ) {
      res.status(503).json({ error: 'RevenueCat webhook is not configured.' });
      return;
    }
    if (env.revenueCat.webhookSecret) {
      const authorization = req.header('authorization') ?? '';
      if (authorization !== `Bearer ${env.revenueCat.webhookSecret}`) {
        res.status(401).json({ error: 'RevenueCat webhook authorization failed.' });
        return;
      }
    }

    const response = await updateSubscriptionFromRevenueCatWebhook(req.body);
    res.status(response.statusCode).json(response.body);
  } catch (error) {
    next(error);
  }
});
