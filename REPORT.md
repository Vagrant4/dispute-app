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
