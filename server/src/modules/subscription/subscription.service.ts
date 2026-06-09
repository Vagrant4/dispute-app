import { env, type StripeBillingMode } from '../../config/env.js';

export type SubscriptionEntitlementStatus = 'FOUNDATION_ONLY';

export interface SubscriptionEntitlement {
  userId: string;
  status: SubscriptionEntitlementStatus;
  isActive: boolean;
  billingMode: StripeBillingMode;
  billingEnforcementActive: boolean;
  pricingDecision: 'undecided';
  message: string;
}

export function getSubscriptionEntitlement(userId: string): SubscriptionEntitlement {
  return {
    userId,
    status: 'FOUNDATION_ONLY',
    isActive: false,
    billingMode: env.stripe.billingMode,
    billingEnforcementActive: false,
    pricingDecision: 'undecided',
    message: 'Subscription billing is not active in V1. No payment is collected and no features are gated.'
  };
}

export function getDisabledCheckoutResponse() {
  if (env.stripe.billingMode === 'disabled') {
    return {
      statusCode: 501,
      body: {
        error: 'Subscription billing is disabled in this V1 foundation.',
        billingMode: env.stripe.billingMode
      }
    } as const;
  }

  return {
    statusCode: 501,
    body: {
      error: 'Stripe checkout session creation is not implemented in this foundation phase.',
      billingMode: env.stripe.billingMode
    }
  } as const;
}

export function getDisabledWebhookResponse() {
  return {
    statusCode: 501,
    body: {
      error: 'Stripe webhook handling is disabled until signature verification is implemented.',
      billingMode: env.stripe.billingMode
    }
  } as const;
}
