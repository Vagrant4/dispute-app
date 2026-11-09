# UI Text Box and Map Fix Report

## Summary

Implemented the requested mobile UI fixes on branch `fix/ui-textbox-map-20261109` without pushing, deploying, publishing, uploading to a store, or changing billing/accounts.

## Root causes

- **Location map:** `locationMapFrame` forced all map content into a 360 px-high container with `overflow: "hidden"`. The component itself required a minimum 240 px map canvas plus padding, gaps, three text rows, and a 48 px action, so **Open in Maps** was clipped. The canvas was also only a stylized ring and dot, not a street basemap.
- **Settings trial subtitle:** the Settings list applied `numberOfLines={1}` to every subtitle, truncating “Trial ended. Existing records remain viewable.”
- **Subscribe CTA:** price and store disclaimer copy were nested inside a fixed-height button, giving the control too much text for its available height.
- **Other reviewed text containers:** Today location/project titles and the project PDF lock note also forced single-line rendering.

## Changes

- `mobile/src/screens/LocationMap.native.tsx`
  - Added a real no-key OpenStreetMap raster basemap using standard slippy-map tiles.
  - Added visible, linked “© OpenStreetMap contributors” attribution.
  - Kept the GPS pin fixed and non-interactive.
  - Kept the accuracy ring, now scaled in metres using Web Mercator resolution.
  - Preserved the external **Open in Maps** action and error handling.
- `mobile/src/styles.ts`
  - Removed the fixed 360 px height and clipping from the overall map frame.
  - Constrained clipping to the 260 px tile canvas only.
  - Added map tile, attribution, details, empty-state, and subscription price-note styles.
  - No font size was reduced.
- `mobile/src/screens/SettingsScreen.tsx`
  - Removed the one-line subtitle limit so trial/status copy wraps fully.
- `mobile/src/screens/PlanBillingPanel.tsx`
  - Kept the concise CTA **Subscribe** inside the button.
  - Moved the store price below the button.
  - Kept the fallback exactly: “S$6.99 a month (final price shown in Google Play)”.
  - For localized prices, kept “Final price shown in Google Play.” below the price.
- `mobile/src/screens/HomeScreen.tsx`
  - Allowed location and project titles to wrap.
- `mobile/src/screens/ProjectDetailScreen.tsx`
  - Allowed the PDF subscription note to wrap.
- `mobile/tests/textBoxMapLayout.test.js`
  - Added five regression tests covering OSM attribution/basemap, fixed pin/accuracy ring, unclipped map layout, wrapped Settings and other explanatory text, and externalized subscription price copy.

Auth, account-required trial behavior, `recordAccess.ts` gates, and GPS persistence were not changed.

## Tests and verification

### Passed

`node --test tests/textBoxMapLayout.test.js` (from `mobile`)

- 5 tests passed
- 0 failed

The debug Android configuration was also inspected and already declares:

- Base application ID: `sg.claimproof.mobile`
- Debug suffix: `.test`
- Resulting debug package: `sg.claimproof.mobile.test`
- Debug signing only

### Blocked by environment

The isolated copy had no installed TypeScript/Expo toolchain. Two `npm ci` attempts (including a repo-local npm cache) could not restore dependencies because outbound registry requests were denied with `EACCES`.

Therefore:

- `npm run typecheck --workspace mobile` — blocked at the shared prebuild because `tsc` is unavailable.
- `npm test` — blocked at the same missing `tsc` prebuild.
- `mobile/android/gradlew.bat :app:assembleDebug` with a repo-local `GRADLE_USER_HOME` — blocked because the Gradle 9.3.1 distribution download was denied with `java.net.SocketException: Permission denied: getsockopt`.

No APK could be produced in this environment, so there is no APK path or SHA-256 to report.

The requested local commit was also attempted with message **fix(mobile): repair map and text layouts**, but this sandbox mounts **.git** read-only. Git failed to create **.git/index.lock** with **Permission denied**. The changes remain in the working tree and were not pushed.

## Installed skills

The requested skills `test-driven-development`, `systematic-debugging`, `verification-before-completion`, and `react-best-practices` were not installed in this session. No Expo/React Native-specific skill was available. Their practices were followed directly: regression tests were written first, the clipping root cause was confirmed before changing layout, changes were kept component-focused, and verification commands were attempted and recorded honestly.

## Remaining verification when network/toolchain access is available

1. Run `npm ci`.
2. Run `npm run typecheck --workspace mobile`.
3. Run `npm test`.
4. From `mobile/android`, run `gradlew.bat :app:assembleDebug`.
5. Hash `mobile/android/app/build/outputs/apk/debug/app-debug.apk` with SHA-256.

## Follow-up

- **Cause:** `LocationMap.web.tsx` still referenced `styles.locationMapFallback` after the native map style refactor removed that key.
- **Fix:** Restored a dark, lime-bordered web fallback with the native map's 260 px minimum height and existing readable type styles. The map attribution now uses the shared caption token, and stale single-line test expectations were aligned with the intentional wrapping behavior.
- **Results (from `mobile`):** `npx tsc -p tsconfig.json --noEmit` passed; `node --test tests/*.test.js` passed all 302 tests with 0 failures.

## Follow-up 2: tile User-Agent

- **Cause:** Android's React Native image loader sent OpenStreetMap tile requests with the generic `okhttp/4.9.2` User-Agent, which OpenStreetMap blocked.
- **Fix:** Added the exported `getTileRequestSource(url)` helper and a single app-identifying User-Agent, `DISPUTE/0.3.2 (sg.claimproof.mobile; Android)`, then routed every raster tile image source through the helper. Tile URLs, map math, zoom, fixed pin, accuracy ring, attribution, action, and layout remain unchanged.
- **Regression coverage:** Extended `mobile/tests/textBoxMapLayout.test.js` to require HTTPS `tile.openstreetmap.org` sources with a non-okhttp User-Agent containing `DISPUTE`.
- **Verification:** Shared passed 32 tests, server passed 171 tests, client passed 24 tests, mobile passed 302 tests, and the mobile TypeScript check passed. All suites reported 0 failures.
- **Implementation commit:** `bb23d0fc9779d1723bd757ef690a80ef6350dd8a` (`fix(mobile): identify OpenStreetMap tile requests`).
## Follow-up 3: tile fix 0.3.3 + Today map + back + safe-area

### Root cause

The 5b76eb4 implementation supplied a User-Agent only through the React Native `<Image source={{ uri, headers }}>` path. On the real phone, OSM answers okhttp/empty-UA tile requests with HTTP 200 and a valid 6,725-byte "Access blocked" PNG. Fresco caches that successful PNG by URI despite the response's `no-cache`, and an app upgrade preserves Fresco storage. That explains both why the bad tile survived the b371a23-to-5b76eb4 upgrade and why a normal HTTP-error fallback could never detect it. Fabric header delivery also had not been proven on-device.

The fix installs `OkHttpClientProvider.setOkHttpClientFactory` before `loadReactNative`. It starts with `createClientBuilder(applicationContext)` so the default cookie jar/cache/timeouts and existing behavior are retained, and a network interceptor replaces User-Agent only when the request host is `tile.openstreetmap.org`; API requests are untouched. JS headers remain as defense in depth. Tile URLs now carry `#osm-v2`: HTTP never sends a URL fragment, while Fresco includes the complete URI in its cache key, so every stale 0.3.2 block image is bypassed without clearing unrelated image caches. This deterministic key bump is more targeted and reliable than trying to race a process-wide Fresco clear after initialization.

### Changes by commit

- `a100708` - native host-scoped tile User-Agent, shared 0.3.3 JS identity, `osm-v2` Fresco cache key, OSM attribution, versionCode 5/versionName 0.3.3, and initial failing guards.
- `5d87086` - embedded fixed-pin Today map, 48dp "Show my location" control, removed separate map/deep-link UI and all on-screen accuracy numbers while retaining stored/report accuracy evidence.
- `b60b6d9` - Android back ordering and safe bottom insets for New project and Photo proof/detail sheets.
- `a152857` - removed the mobile referral screen, Settings/Create account entry/copy, navigation types, module, and obsolete referral tests; server referral code and schema were not changed.
- `da31582` - Jest/RNTL, Maestro flows, and the two device screenshot audit scripts.

### Back and popup audit

- `ProjectNameSheet` (New/Rename project): React Native `Modal.onRequestClose`; parent custom picker/sheet state is also consumed by `BackHandler` before app navigation.
- Photo proof capture sheet: `Modal.onRequestClose` closes unless a save is in flight; swipe-down/Cancel paths remain.
- Photo detail modal: `Modal.onRequestClose` clears the selected detail.
- Projects detail: screen `BackHandler` invokes the same pop-to-project-list state transition as its visible back control.
- Settings sub-pages and currency/rate dropdown overlays: screen `BackHandler` closes the open dropdown first, then pops delete -> Privacy, More children -> More, and other pages -> Settings.
- App root: after child handlers, a non-home tab returns to Today; Today shows "Press back again to exit" and only the second press inside two seconds exits.

### Safe-area fixes

- New project sheet applies `max(bottomInset, 24)` below Save/Cancel.
- Photo proof and photo detail scroll content apply `max(bottomInset, 24)` below Save, Import, Cancel, and detail actions.
- The existing bottom tab bar remains a bottom-edged `SafeAreaView`, so sheet content and tabs independently account for gesture and 3-button navigation.

### Test results

- Mobile strict typecheck: passed.
- Mobile Node suite: 302/302 passed.
- Jest/RNTL: 4 suites, 4 tests passed.
- Full root `npm test`: shared 32/32, server 171/171, client 24/24, mobile typecheck, mobile 306/306 all passed.
- Maestro was intentionally not run because this PC has no emulator; the box owns those flows and device/TLS header proof.
- Extra `:app:compileDebugKotlin` attempt stopped before compilation because this PC has no Android SDK configured (`ANDROID_HOME`/`mobile/android/local.properties`), not because of a Kotlin diagnostic.

### Skill availability and remaining device proof

The requested `systematic-debugging`, `test-driven-development`, `verification-before-completion`, `react-best-practices`, and Expo/React Native/Android skills were not installed in this environment. Their practices were followed manually: root cause and cache behavior first, failing tests before production edits, small scoped components/host-only networking, and full available verification before completion. No provider account/key, debug network override, push, PR, deploy, billing/auth/account configuration change, or other checkout was touched. The box still needs to prove the header on its TLS logger, run Maestro with mocked GPS, and run the screenshot sweeps against the APK.

## Follow-up 4: single entitlement source

### Root cause and gate trace

- The server status/cache adapter is `mobile/src/subscription/subscriptionClient.ts:42`; it reads `/subscription/status` and only falls back to a still-current cached entitlement after a network failure.
- Today used `useSubscriptionAccess` (`HomeScreen.tsx:30`) and derived its banner from that hook's `trialEndsAt` (`HomeScreen.tsx:68-69`) and `canCreateRecords` (`HomeScreen.tsx:303-305`). Settings and Plan used another hook instance (`SettingsScreen.tsx:72-77`) and `planTrialLine` (`SettingsScreen.tsx:103`, `PlanBillingPanel.tsx:26`). Each hook instance previously owned independent React state, so mounted screens could disagree until their own refresh ran.
- Reports had a third, independent entitlement state plus its own direct status request. The old `ProgressClaimReportsScreen.tsx:54-60,164-183` path could retain a different response than Today/Settings. Its PDF/CSV/file actions all reached `ensureCanExport`, but `canExportProgressClaim` and `getDisputePackExportAccess` additionally required `hasPaidSubscription`; that helper explicitly excluded `TRIALING`. Thus an extended server trial could display as current in one screen while the report gate remained locked even when `canExportReports` was true.
- The fixed source is the shared external store in `useSubscriptionAccess.ts:12-78`. App start and foreground-active refresh are at `useSubscriptionAccess.ts:34-49`; Settings refreshes it after a completed purchase at `SettingsScreen.tsx:116-132`. Today, Projects, Photos, Settings/Plan, and Reports now read that same snapshot. Reports no longer import or directly call `fetchSubscriptionStatus`.
- The canonical rules are now `hasCurrentFullAccess` plus the server's `canExportReports` flag (`subscriptionClient.ts:108-136`, `recordAccess.ts:26-38`): current extended/active trial unlocks signed-in PDF and CSV, expired trial without subscription locks, and a current active subscription unlocks. Guest/account-required behavior remains (`recordAccess.ts:31`), and Today still renders the real ended state (`HomeScreen.tsx:303-305`). No server or billing/trial rule was changed.

### Project page proposal implemented

What stays: the selected-project picker (`ProjectDetailScreen.tsx:25`) and the single `Create & share PDF` action (`ProjectDetailScreen.tsx:35`). The page ends there. What was removed from this render: period/week line, Preview/CSV, Status/lock card, Earlier reports, Show sessions, Sessions and its empty text, pay rate, metric tiles, project-complete/rename/site summary, and Photos/See all. Their data/repositories and reusable report components remain for other screens; the minimal option was to stop rendering them in the compact project route.

Settings now owns the report-period control (`SettingsScreen.tsx:288`) and per-project pay-rate controls (`SettingsScreen.tsx:277-294`). The rate still writes `project.hourlyRateCents`; it is not global. PDF construction loads the saved period and the selected project's rate (`ProgressClaimReportsScreen.tsx:121-139`). Stable Maestro IDs are `project-picker`, `create-share-pdf`, `settings-report-period`, `settings-pay-rate-project-picker`, `settings-pay-rate-input`, and `settings-pay-rate-save`.

### Tests and commits

- Added `entitlement.test.ts`, `projectPage.test.tsx`, and `settingsPayRate.test.tsx`; updated obsolete source-contract tests to the new trial and minimal-project behavior.
- Implementation/test commit: `a62980b`. Documentation/verification commit: the following local commit.
- Verification passed: mobile strict typecheck; mobile Node 302/302; Jest 12/12 in 7 suites; full root `npm test` with shared 32/32, server 171/171, client 24/24, mobile 302 Node + 12 Jest.
