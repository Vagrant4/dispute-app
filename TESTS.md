# Test inventory

## Required verification

- `npm run typecheck --workspace mobile`: strict TypeScript compile.
- `npm test --workspace mobile`: runs all 302 Node tests in `mobile/tests/*.test.js`, then the four Jest/RNTL tests below.
- `npm test`: builds and tests shared (32 cases), server (171), client (24), then mobile typecheck and all mobile tests (306 cases).
- `cd mobile/android && gradlew.bat :app:compileDebugKotlin`: native Android compile; requires an installed Android SDK and `ANDROID_HOME` or `android/local.properties`.

The existing Node suite is one test file per mobile subsystem under `mobile/tests/`. Node prints every individual case name; the full inventory is obtained with `node --test mobile/tests/*.test.js`. Follow-up 3 added `followUp3Guards.test.js` cases for the shared 0.3.3 tile identity, native interceptor, cache-key version, Today map/locate control, removed accuracy/map-link/referral UI, Modal back handling, and sheet safe areas. Obsolete `referralFlow.test.js` and `privacyReferralWording.test.js` were removed with the mobile referral feature; affected map, accuracy, Settings, and project-site expectations were deliberately updated.

## Jest / React Native Testing Library

- `mobile/__tests__/todayMap.test.tsx`: Today renders the embedded map; pressing "Show my location" requests a fresh location and keeps the map mounted.
- `mobile/__tests__/tileMap.test.tsx`: tile Images include the app User-Agent and `osm-v2` fragment cache key; removed map/accuracy copy is absent.
- `mobile/__tests__/noReferAFriend.test.tsx`: no referral route, copy, entry point, screen, or mobile module remains.
- `mobile/__tests__/backNavigation.test.tsx`: source contract for sheet-first, inner-page, tab-to-Today, and double-back exit ordering.

Run: `npm run test:components --workspace mobile`.

## Maestro (run on the box, not this PC)

- `mobile/.maestro/today_map.yaml`: Today map, locate control, and screenshot.
- `mobile/.maestro/sheets_and_keyboard.yaml`: New project and Photo proof input visibility; Save/Cancel visibility and dismissal.
- `mobile/.maestro/back_navigation.yaml`: project detail back, Photo proof back, Settings sub-page back, and non-home tab to Today.
- `mobile/.maestro/auth_keyboard.yaml`: login input remains visible with the keyboard and captures a screenshot.

Run after setting the emulator's mock GPS: `maestro test mobile/.maestro`.

## Device screenshot tools

- `python mobile/scripts/ui-sweep.py dump.xml --bottom-reserved 144` or `python mobile/scripts/ui-sweep.py --serial SERIAL`: flags clickable overlap, off-screen/bottom-region controls, and text ending in `...` or `…`.
- `python mobile/scripts/tile-check.py screenshot.png --crop left,top,right,bottom`: with Pillow available, returns exit 1 when the crop matches the yellow/black/white OSM block image heuristic.
