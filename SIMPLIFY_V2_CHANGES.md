# Simplify v2 — Chunk A

Implemented Task 1 Step 1 and addendum A with the DECISIONS overrides.

- Separate stop address and GPS fields; no clock-in fallback at stop.
- GPS-only Home chip using existing dark theme tokens; source, sensor accuracy and fix time recorded. Start saves immediately; first fix waits at most 20 seconds. Stop waits at most 10 seconds and clears the timeout.
- Refresh appends readings without replacing phase evidence; start refresh while working, stop refresh within 10 minutes. Late start results cannot attach to stopped entries.
- Worker note saved separately and explicitly labelled in app and reports. Reports include start, stop and refreshed readings, GPS accuracy/time, no-fix and legacy labels. CSV appends the five requested columns.
- Mobile migration 8 and fresh schema include location fields and photo GPS accuracy. Backup uses SELECT * and dynamic insert columns, so no fixed column lists needed changing; real SQLite backup/restore tests cover the new fields.
- Website form and record detail say Note (typed). Additive Prisma field defaults to typed for new rows; migration marks existing records legacy. Web note writes set typed provenance.
- Photo GPS includes accuracy; badge requires coordinates. Gallery imports do not request current GPS and display Gallery · time unknown.

Files changed:

- mobile/src/db/schema.ts
- mobile/src/work/locationEvidence.ts (new)
- mobile/src/work/workLocation.ts
- mobile/src/work/workRepository.ts
- mobile/src/work/webWorkStore.ts
- mobile/src/screens/HomeScreen.tsx
- mobile/src/styles.ts
- mobile/src/reports/progressClaimTypes.ts
- mobile/src/reports/progressClaimSourceRepository.ts
- mobile/src/reports/progressClaimSnapshot.ts
- mobile/src/reports/progressClaimCsv.ts
- mobile/src/photos/photoGps.ts
- mobile/src/photos/photoEvidenceTypes.ts
- mobile/src/photos/photoEvidenceRepository.ts
- mobile/src/screens/PhotoEvidenceScreen.tsx
- client/src/pages/TimeEntriesPage.tsx
- server/prisma/schema.prisma
- server/prisma/migrations/20261029000000_location_source/migration.sql (new)
- server/src/modules/time/time.service.ts
- mobile/tests/stopLocation.test.js (new, 6 tests)
- mobile/tests/locationSource.test.js (new, 12 tests)
- mobile/tests/locationTestHelpers.js (new; TypeScript loader and real SQLite fixture)
- mobile/tests/workRepository.test.js
- mobile/tests/reportSnapshot.test.js
- mobile/tests/trialFlowGuards.test.js (original LF preserved)
- mobile/tests/photoEvidenceRepository.test.js
- server/tests/locationSource.test.ts (new, 1 Prisma/database/service test)
- SIMPLIFY_V2_CHANGES.md (new)

Validation:

- Shared build: passed.
- Mobile typecheck: passed.
- npm run test --workspace mobile: 41 test files passed. Running with --test-isolation=none confirms 190 individual tests passed (18 new).
- Client: 24 tests passed; npx tsc -b passed.
- New server locationSource test: passed.
- Full server suite: 22 passed, 146 skipped, 11 setup errors because this sandbox denies 127.0.0.1 listeners (EPERM). The normal command was attempted; a second run with shorter hook timeouts confirmed the same restriction. No HTTP tests or gates were weakened to hide the restriction.

Commit requested: simplify-v2 A: GPS-only location evidence and stop-location fix.
Git add/commit was attempted, but .git is read-only and Git cannot create index.lock. Changes cannot be staged or committed in this sandbox. Branch remains feature/simplify-v2; no remote changes.
