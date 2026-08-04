# Payment configuration review

## Intended production path

DISPUTE mobile subscriptions use Google Play Billing/App Store billing through RevenueCat. The intended Android product is `dispute_basic_monthly`; the expected RevenueCat entitlement is `dispute_basic`. The application does not collect card details and must not contain RevenueCat secret keys, Google service-account credentials, Stripe secret keys, or webhook secrets.

The mobile client now:

- accepts only RevenueCat public platform SDK keys (`goog_` on Android and `appl_` on iOS);
- rejects RevenueCat Test Store keys beginning with `test_`;
- configures `useAmazon: false`;
- disables RevenueCat diagnostics and automatic device-identifier collection;
- requires the configured entitlement to be active before reporting a successful purchase;
- provides an explicit **Restore purchases** action and requires the restored customer information to contain the configured active entitlement;
- removes Amazon IAP, simulated-store, and Google billing-test companion components from the production Android manifest.

The server now:

- requires matching product and entitlement identifiers on RevenueCat webhook events;
- accepts only Google Play and Apple App Store events, and rejects sandbox events when the server runs in production;
- rejects unsupported webhook event types;
- returns 503 in production if the webhook secret, product ID, or entitlement ID is absent;
- requires `STRIPE_BILLING_MODE=disabled` in production.
- preserves export access after cancellation until the recorded paid period end, then changes the effective status to expired.

## Required EAS/mobile configuration

Set these through the protected build environment. The two SDK keys are RevenueCat public app-specific keys, not secrets, but should still be managed as environment configuration:

- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` - RevenueCat Google Play public SDK key (`goog_...`).
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` - RevenueCat App Store public SDK key (`appl_...`).
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=dispute_basic`.
- `EXPO_PUBLIC_REVENUECAT_PRODUCT_ID=dispute_basic_monthly` (required production configuration, even though the app fails safely to the same identifier).

## Required server configuration

- `REVENUECAT_WEBHOOK_SECRET` - server-only secret used to authenticate RevenueCat webhooks.
- `REVENUECAT_PRODUCT_ID=dispute_basic_monthly`.
- `REVENUECAT_ENTITLEMENT_ID=dispute_basic`.
- `STRIPE_BILLING_MODE=disabled`.

Stripe placeholder routes/configuration remain in the server for non-production development history, but production startup rejects test/live Stripe billing modes and the mobile checkout endpoint directs users to the platform store. No Stripe secret is used by the mobile app.

## EAS production configuration status

On 27 July 2026, the following public identifiers were created in the EAS `production` environment and then confirmed present without printing their values:

- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=dispute_basic`;
- `EXPO_PUBLIC_REVENUECAT_PRODUCT_ID=dispute_basic_monthly`.

`EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` is still missing. No placeholder was created. The account owner must copy the public Android app-specific SDK key beginning with `goog_` from the correct RevenueCat project before another production Android build is approved. The iOS public key is not required for the next Android-only build.

## Account-level checks still required

Code inspection cannot prove dashboard state. Before a paid release, the account owner must confirm in Google Play Console and RevenueCat that:

1. `dispute_basic_monthly` exists, is active, has the intended country availability and price, and belongs to the DISPUTE Play application.
2. The product is attached to the current RevenueCat offering/package.
3. The `dispute_basic` entitlement contains that product.
4. Google Play service credentials are connected to the correct RevenueCat project.
5. The RevenueCat production webhook targets the live HTTPS server and uses the same secret configured server-side.
6. License testers can purchase, restore, cancel, expire, and renew without charging non-test accounts.

These dashboard checks must not be marked complete until verified in the corresponding owner accounts.
