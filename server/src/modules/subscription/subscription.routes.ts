import { Router } from 'express';
import { requireUser } from '../../middleware/requireUser.js';
import {
  getDisabledCheckoutResponse,
  getDisabledWebhookResponse,
  getSubscriptionEntitlement
} from './subscription.service.js';

export const subscriptionRouter = Router();

subscriptionRouter.get('/status', requireUser, (req, res) => {
  res.json({ subscription: getSubscriptionEntitlement(req.user!.id) });
});

subscriptionRouter.post('/create-checkout-session', requireUser, (_req, res) => {
  const response = getDisabledCheckoutResponse();
  res.status(response.statusCode).json(response.body);
});

subscriptionRouter.post('/webhook', (_req, res) => {
  const response = getDisabledWebhookResponse();
  res.status(response.statusCode).json(response.body);
});
