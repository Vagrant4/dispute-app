# ClaimProof SG Mobile Budget Architecture And Stripe Design

Date: 2026-06-09

## Purpose

ClaimProof SG should evolve from the completed V1 web app into an official mobile app for Apple App Store and Google Play while keeping operating cost low.

The mobile app should be useful offline, store sensitive evidence records locally on the device, and avoid paid cloud services unless they are required for subscription entitlement or future sync.

This design supersedes the earlier V1 placeholder-only Stripe scope for the next architecture slice. Stripe may be prepared as a subscription foundation, but direct Stripe checkout inside the iOS/Android app must remain disabled until App Store and Google Play billing policy decisions are made.

## Recommended Approach

Use Option A:

```text
client/          Existing React web app, kept working
server/          Existing Express API, extended only where needed
mobile/          New Expo React Native app
shared/          Shared TypeScript types and calculation/report utilities
docs/            Mobile privacy, data safety, backup, and store-readiness docs
```

This keeps the current web app stable while adding a native-app path suitable for Expo, Apple App Store, and Google Play.

## Mobile Architecture

The mobile app should use Expo React Native.

Core mobile dependencies should be selected from Expo-friendly, open-source libraries:

- SQLite local database for structured data.
- Device file system for photos, JSON backups, generated PDFs, and generated CSVs.
- Camera and image picker for evidence capture.
- Location permission for optional GPS capture.
- Native share sheet for report export.

The mobile app should not require a backend for day-to-day evidence recording. The server is optional for subscription entitlement checks and future account services.

## Offline-First Storage

The mobile app stores these locally in SQLite:

- Worker profile
- Clients / companies
- Projects
- Time entries
- Photo evidence metadata
- Pay summaries
- Progress claim report metadata
- App settings
- Subscription entitlement cache

Photos are copied into app-owned local file storage. Photo evidence records store:

- Local file path
- Caption
- Evidence type
- Timestamp
- Project ID
- Optional time entry ID
- Optional GPS latitude/longitude
- Created date

Generated reports are stored as local files and can be shared or exported manually.

## Shared Logic

Create a `shared/` folder for logic that should be used by web, server, and mobile:

- Time calculation
- Overtime calculation
- Pay calculation
- Report snapshot generation
- Shared enums and TypeScript types
- CSV helper functions where feasible

The first mobile slice should extract or copy shared logic conservatively. The web and server apps must keep passing tests after extraction.

## Export And Share Flow

The mobile app should generate reports locally where possible:

- Progress claim PDF
- Time entries CSV
- Pay summary CSV
- Progress claim summary CSV
- Full JSON backup

The app should use the native device share sheet for:

- Email through the user's own email app
- WhatsApp, Telegram, or other installed messaging apps
- Google Drive, iCloud Drive, Dropbox, or other installed file apps
- Local Files app save flow where supported

The app must not automatically send email from a backend in this phase.

## Privacy And Data Safety

All work records, pay details, photos, GPS, FIN/NRIC, and worker IDs are sensitive.

The mobile app must include a clear privacy notice explaining:

- Data is stored locally on the device by default.
- Photos and reports are stored locally on the device.
- No cloud sync exists in the first mobile version.
- Subscription entitlement checks may contact the server if subscription is enabled.
- Stripe checkout and billing records are handled by Stripe if the user subscribes through a Stripe web checkout.
- Uninstalling the app, changing phones, or losing the device may delete local records unless the user exports or backs up data.
- The app does not send analytics in V1 unless the user explicitly consents in a future version.

Settings / Backup must show this warning exactly:

> ClaimProof SG stores records locally on this device. If you delete the app, change phone, or lose the device, your records may be lost unless you export or back them up.

## Backup And Restore

Mobile V1 must include at minimum:

- Export all SQLite records as JSON.
- Export generated reports.
- Clear backup warning.

Import/restore can be a placeholder if full restore is too large for the first mobile slice. The placeholder must explain that restore is planned and that exported JSON should be kept safe.

## Subscription Model

The requested subscription plan is:

- Plan name: ClaimProof SG Basic
- Price: USD 1 per month
- Billing cadence: monthly
- Billing provider foundation: Stripe

Because the app is intended for Apple App Store and Google Play, subscription implementation must be policy-aware:

- Apple App Store: subscriptions that unlock digital app functionality usually need Apple in-app purchase unless a valid external purchase link entitlement/storefront rule applies.
- Google Play: Google Play Billing is generally required for in-app subscriptions of digital goods or app functionality distributed through Google Play.
- Stripe: appropriate for web checkout, direct web subscriptions, and backend entitlement management, but not automatically safe as an in-app mobile purchase path.

Official policy references:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play Payments Policy: https://support.google.com/googleplay/android-developer/answer/10281818
- Stripe Pricing: https://stripe.com/pricing

## Stripe Foundation

Prepare Stripe in the backend and docs, not as direct in-app mobile checkout.

Server-side Stripe foundation:

- Stripe price/product configuration via environment variables.
- Create checkout session endpoint for web/direct checkout.
- Stripe webhook endpoint.
- Subscription entitlement lookup endpoint.
- Customer portal endpoint where feasible.
- Subscription status model or fields.

Mobile app:

- Subscription Status screen.
- Local cached entitlement status.
- Manual refresh subscription status button.
- Billing CTA placeholder that explains billing is web/store-policy dependent.
- No direct Stripe checkout button inside iOS/Android builds until policy path is confirmed.

This keeps the $1/month Stripe plan prepared while avoiding an avoidable App Store or Play Store rejection.

## Cost Control Rules

Avoid in this phase:

- Paid cloud database
- Paid file storage
- Paid email API
- Paid SMS OTP
- Paid OCR
- Paid AI features
- Paid analytics
- Cloud sync

Use:

- Local SQLite
- Device file system
- Native share sheet
- Manual export
- Open-source libraries
- Expo Application Services only when needed for build/submission
- Minimal backend only for Stripe/web subscription entitlement if subscription is enabled

## Mobile Screens For First Architecture Slice

Create a mobile foundation with these screens:

- Home / dashboard shell
- Privacy notice
- Settings / backup
- Subscription status
- Local storage diagnostics

Feature-complete replicas of every web screen can come after the mobile foundation is stable.

## App Store Readiness Documents

Create these docs:

- `docs/MOBILE_APP_STORE_PLAN.md`
- `docs/PRIVACY_DISCLOSURE_DRAFT.md`
- `docs/DATA_SAFETY_NOTES.md`
- `docs/LOCAL_STORAGE_BACKUP_POLICY.md`

They must cover:

- What data is stored.
- Where data is stored.
- Whether data leaves the device.
- Permissions used.
- Backup/export limitations.
- Subscription and payment data handling.
- User responsibility to export important records.

## Explicit Non-Goals

Do not build these in the mobile architecture slice:

- Cloud sync
- User-to-user sharing
- Employer approval
- Payment collection inside iOS/Android app
- CPF automation
- MOM submission
- AI OCR
- AI photo analysis
- Paid analytics

## Testing And Verification

Required checks for the implementation plan:

- Existing web tests still pass.
- Existing server tests still pass.
- Mobile TypeScript check passes.
- Shared calculation tests pass.
- Mobile local SQLite service tests or smoke tests exist where practical.
- Documentation clearly states local-only backup risk.

## Open Policy Decision

Before App Store or Google Play submission, choose one billing path:

1. Store-native subscriptions for mobile app stores, with Stripe only for web/direct purchases.
2. Stripe web checkout only outside the app, with no in-app purchase CTA, if store policy permits the chosen distribution.
3. Region-specific external purchase link entitlement strategy, only after confirming eligibility and implementation obligations.

Until that decision is made, the app must keep the mobile billing UI as status/placeholder only.
