import { Router } from 'express';
import { env } from '../../config/env.js';
import { requireUser } from '../../middleware/requireUser.js';
import {
  getMobileStoreCheckoutResponse,
  getSubscriptionEntitlement,
  updateSubscriptionFromRevenueCatWebhook
} from './subscription.service.js';

export const subscriptionRouter = Router();

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

subscriptionRouter.post('/webhook', async (req, res, next) => {
  try {
    if (env.nodeEnv === 'production' && !env.revenueCat.webhookSecret) {
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
