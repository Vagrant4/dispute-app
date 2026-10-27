# Simplified flow and 30-day guest trial

## Changed

- Added guest-session persistence and a monotonic 30-day local trial clock.
- Added guest start, relaunch restoration, guest-to-account ownership migration, and guest header text.
- Moved the Home time toggle to the top, added automatic `Job 1 · <day month>` creation, collapsed details, automatic non-blocking GPS, and a visible no-GPS warning.
- Made project rates optional (`0` means not set) and changed reports to label unset rates.
- Made the four tabs equal width.
- Added one-tap dispute-pack PDF creation/sharing and removed the duplicate latest-report download/view controls.
- Removed registration password confirmation and forwards the guest `firstUseAt` anchor.
- Added the server `User.appFirstUseAt` migration and anchored server trials to the earlier of first use and email verification.
- Extended the flow-test mock and added device-only trial-clock controls guarded by `EXPO_PUBLIC_TRIAL_DEBUG_OVERRIDE=1`.
- Added pure access helpers and regression tests for trial days, rollback, expiry, clock-out, viewing, optional rates, registration, project naming, and release flags.

## Decisions

- Kept `hourly_rate_cents` non-null and stores `0` to avoid a mobile database migration.
- Clock-out never checks entitlement; only starting a new entry is gated.
- Existing records and already-created files remain listed and viewable after expiry.
- Guest rows are updated in place from `local-user` to the verified user ID.

## Could not run

Node.js, npm, git, and TypeScript executables were not available on this environment's PATH, so tests and type-checking could not be executed here. No install or network command was attempted.

## Exact verification commands

```text
node --test mobile/tests/*.test.js
npx tsc -p mobile/tsconfig.json --noEmit
npm test --workspace server -- --run tests/auth.test.ts tests/subscription.test.ts
```
