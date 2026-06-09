# Stripe Subscription Foundation

## Current Status

ClaimProof SG V1 has subscription foundation placeholders only. There is no active billing enforcement, no feature gating, no checkout session creation, and no entitlement persistence in this phase.

The server exposes conservative status and disabled placeholder responses so later monetization work has a clear place to attach compliant billing behavior.

## Pricing Status

Pricing is undecided. A previous request mentioned `$1/month`, but that should not be treated as final product truth. The price should be validated after the real-user trial because payment fees, App Store and Google Play policy, and user value may make `$1/month` weak.

Candidate pricing mentioned in product review includes Free plus `S$4.99/month` or `S$49/year`, but those are validation candidates, not committed prices.

## Mobile Store Policy Note

Do not put Stripe checkout for a digital app subscription inside the iOS or Android mobile app unless policy and legal review confirms it is allowed.

For mobile digital features, the likely paths are platform in-app purchase or an external web strategy only where App Store and Google Play policy allows it. This phase intentionally adds no mobile Stripe checkout button and no payment SDK.

## Low-Cost Approach

1. Run the manual real-user trial first.
2. Keep subscription status as a foundation-only placeholder during V1.
3. Add an entitlement cache later only after pricing and compliance decisions are made.
4. Add web checkout later only if the selected product strategy and platform rules allow it.

## Environment Placeholders

The server parses these values without requiring real Stripe keys in local development:

```txt
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_MONTHLY=
STRIPE_PRICE_ID_YEARLY=
STRIPE_BILLING_MODE=disabled|test|live
```

`STRIPE_BILLING_MODE` defaults to `disabled`.

## Later Webhook Events

When billing is implemented, these Stripe events should be handled after webhook signature verification:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

## Security Notes

Verify Stripe webhook signatures before trusting any event payload. Do not update user entitlements from unsigned or unverified webhook bodies.

Never trust client-provided subscription status. Clients may display status, but the server must own entitlement decisions when billing enforcement is introduced.

Do not enable billing enforcement until entitlement persistence, webhook verification, user ownership checks, and store policy review are complete.
