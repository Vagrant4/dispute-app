# Android security verification results

Verification was run on branch `codex/android-production-security-fixes` from fixed point `main` (`56213ba`). The original source project was used. No decompiled APK source was used to implement the fixes.

## Result summary

| Check | Result | Evidence |
| --- | --- | --- |
| Clean dependency installation | PASS | npm 10.9.4 lock-only install, `ci --dry-run`, and full `ci` completed; 1,473 packages installed. |
| Expo project health | PASS | `expo-doctor` passed 20/20 checks after replacing the legacy splash field, aligning SDK 56 patch versions, and documenting the intentionally maintained native-project configuration. |
| Type checking | PASS | Mobile TypeScript check and server TypeScript build completed with exit code 0. |
| Linting | PASS WITH WARNINGS | Expo lint completed with 0 errors and 12 pre-existing warnings. |
| Unit tests | PASS | Final full workspace run: shared 30/30, server 113/113, client 24/24, and mobile 113/113. The focused subscription suite passed 10/10. |
| Android release AAB build | PASS | Optimized `bundleRelease` completed and produced `app-release.aab`. |
| Android debug APK build | PASS | Final `assembleDebug` completed and produced `sg.claimproof.mobile.test` / `DISPUTE Test`, signed only with the local Android Debug certificate. |
| Merged release manifest | PASS | Inspected generated release manifest; final permissions and exported components are below. |
| Release debug state | PASS | Generated `BuildConfig.DEBUG = false`; `android:debuggable` is absent, therefore false by platform default. |
| Cleartext and backup state | PASS | Merged manifest has `usesCleartextTraffic=false` and `allowBackup=false`, with strict backup/data-extraction rules attached. |
| Dev/test module markers | PASS | Zero merged-manifest matches for Expo dev launcher/menu, Metro, Amazon IAP, RevenueCat simulated store, or billing test companion. |
| Local signing check | EXPECTED FAIL / BLOCKER | The current local AAB is unsigned by design and contains no debug certificate. The debug certificate appears only on the clearly marked test APK. The approved EAS attempt was rejected before queueing because the monthly Android build allowance is exhausted. |
| Dependency vulnerability scan | COMPLETED / FINDINGS | Full npm tree: 49 advisories (0 critical, 29 high, 19 moderate, 1 low). Production tree: 17 advisories (0 critical, 4 high, 13 moderate). No force or breaking dependency upgrades were made. |
| Secret scan | PASS | High-confidence patterns found 0 matching tracked files; tracked keystore/credential files: 0. |
| Payment environment verification | PARTIAL / BLOCKED EXTERNALLY | The RevenueCat product and entitlement identifiers are present in EAS production. The Android public SDK key is missing, and Google Play/RevenueCat dashboard state remains owner verification. |

## Commands executed

Commands are shown without credentials or secret values.

```powershell
git switch -c codex/android-production-security-fixes
node $env:TEMP\dispute-npm-10.9.4\package\bin\npm-cli.js install --package-lock-only --include=dev --ignore-scripts --no-audit --no-fund
node $env:TEMP\dispute-npm-10.9.4\package\bin\npm-cli.js ci --include=dev --dry-run --ignore-scripts --no-audit --no-fund
node $env:TEMP\dispute-npm-10.9.4\package\bin\npm-cli.js ci --include=dev --ignore-scripts --no-audit --no-fund
npm exec --workspace server prisma generate
npm run typecheck --workspace mobile
npm run lint --workspace mobile
npm run test --workspace mobile
npm run build --workspace server
npm test
npm run test --workspace server
node_modules\.bin\vitest.cmd run tests/subscription.test.ts tests/env.test.ts
npm test -- --run tests/subscription.test.ts
npx expo install expo@~56.0.17 expo-image-picker@~56.0.22 expo-location@~56.0.22 expo-sharing@~56.0.23 expo-splash-screen
npx expo config --type public --json
npx expo-doctor
mobile\android\gradlew.bat :app:bundleRelease :app:assembleRelease --no-daemon --console=plain --max-workers=2
mobile\android\gradlew.bat clean bundleRelease --no-daemon
mobile\android\gradlew.bat :app:assembleDebug --no-daemon --console=plain --max-workers=2
mobile\android\gradlew.bat assembleDebug bundleRelease --no-daemon --max-workers=2
aapt dump badging mobile\android\app\build\outputs\apk\release\app-release-unsigned.apk
aapt dump permissions mobile\android\app\build\outputs\apk\release\app-release-unsigned.apk
apksigner verify --verbose --print-certs mobile\android\app\build\outputs\apk\release\app-release-unsigned.apk
jarsigner -verify -verbose -certs mobile\android\app\build\outputs\bundle\release\app-release.aab
npm audit --json
npm audit --omit=dev --json
git grep -IlE <redacted-high-confidence-secret-pattern> -- tracked-files
git ls-files <keystore-and-credential-patterns>
eas build --platform android --profile production --non-interactive --wait
eas build:list --platform android --limit 2 --json --non-interactive
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID --visibility plaintext --scope project --non-interactive --force
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_PRODUCT_ID --visibility plaintext --scope project --non-interactive --force
eas env:list --environment production --format short
eas config --platform android --profile production --json
```

`NODE_ENV=production`, JDK 17, and the configured Android SDK were used for the final release builds.

The EAS environment-list output was reduced to presence checks so no values were printed. It confirmed the product and entitlement identifiers are present and the Android public SDK key is missing. The resolved production profile uses the `production` environment, remote credentials, store distribution, automatic version increments, and Android App Bundle output. No new build was launched during this configuration step.

## Important intermediate failures and resolution

- The first server build failed after the clean install because install scripts were deliberately disabled and Prisma Client had not been generated. Running `prisma generate` fixed the clean-build prerequisite; the server build then passed.
- One existing client registration test was stale relative to `main` commit `56213ba`, which had moved required profile fields into the unauthenticated registration request. The test was updated to assert the current secure pre-verification behavior; the full client suite passed 24/24.
- The first combined optimized Gradle build exceeded the 10-minute command timeout. A narrowed `bundleRelease` run completed successfully, and the final combined incremental release build completed in 147 seconds.
- After the Expo patch alignment, a final clean `bundleRelease` completed successfully in 883.2 seconds. Its AAB hash replaces the earlier local preflight hash.
- A separate debug/test APK build reached the 10-minute timeout after producing its merged debug manifest and generated resources. Those outputs prove package `sg.claimproof.mobile.test`, cleartext/debuggable debug-only behavior, and label `DISPUTE Test`, but no final debug APK is claimed.
- The final combined `assembleDebug bundleRelease` command later completed successfully and produced the debug APK described below, closing that intermediate gap.
- A parallel server test run timed out and left a Vitest process holding `server/prisma/test.db`. The verified orphan process was stopped; the minimized subscription suite passed 8/8. The final focused subscription suite passed 10/10 and the final full server suite passed 113/113.

## Final release artifact hashes

- AAB: `mobile/android/app/build/outputs/bundle/release/app-release.aab`
  - Size: 40,271,070 bytes
  - SHA-256: `73223B1EE045F342E6FA3A63118FD72CB3B1FC06EA2346BCF62E9723FA9FCBD1`
- Debug test APK: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`
  - Size: 148,315,774 bytes
  - SHA-256: `ADB2C27F2D6252C4377BAFFCADD54A2E5939FA3BD0B9ECF8278C88C690978C7C`

The debug APK is for device testing only. The local unsigned AAB is a preflight artifact and must not be distributed as a production release.

## Final merged-manifest security state

- Package: `sg.claimproof.mobile`
- Version: `0.2.0`
- Version code: `2`
- `BuildConfig.DEBUG`: `false`
- `android:debuggable`: absent (Android default is false)
- `android:allowBackup`: `false`
- `android:usesCleartextTraffic`: `false`
- Backup configuration: `@xml/backup_rules`
- Data extraction configuration: `@xml/data_extraction_rules`

The final release manifest contains zero matches for:

- Expo Dev Client, Dev Launcher, Dev Menu, and Metro markers;
- Amazon IAP and RevenueCat simulated-store components;
- Google billing test companion;
- `exp+claimproof-sg`;
- `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, legacy storage, biometric/fingerprint, and vibration permissions.

## Final permissions

1. `android.permission.ACCESS_COARSE_LOCATION`
2. `android.permission.ACCESS_FINE_LOCATION`
3. `android.permission.CAMERA`
4. `android.permission.INTERNET`
5. `android.permission.ACCESS_NETWORK_STATE`
6. `com.android.vending.BILLING`
7. `sg.claimproof.mobile.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`

The seventh permission is an AndroidX-generated, package-scoped signature permission used to protect dynamically registered receivers. It is not a broad user permission.

## Final exported components

| Type | Component | Protection |
| --- | --- | --- |
| Activity | `sg.claimproof.mobile.MainActivity` | Launcher activity; no custom deep-link filter remains. |
| Receiver | `androidx.profileinstaller.ProfileInstallReceiver` | Requires `android.permission.DUMP`; used by AndroidX profile installation. |

No exported Amazon, simulated-store, dev launcher, or custom-scheme component remains.

## Signing certificate summary

- Local AAB: unsigned (`jarsigner`: `jar is unsigned`).
- Debug test APK: signed with the local Android Debug certificate as expected for `sg.claimproof.mobile.test`; it is not a production artifact.
- Android debug certificate: not used by either release artifact.
- Production upload/app-signing certificate: not yet verified for this source revision. The approved EAS command found the remote managed keystore but the Free-plan quota stopped the build before queueing. Historical preview builds are not evidence for this branch.

Run an explicitly approved EAS production cloud build, download the resulting AAB, then record only its certificate owner/issuer, validity, and SHA-256 fingerprint. Do not copy the keystore or password into this repository.

## Dependency audit findings

After aligning Expo SDK 56 patch versions, the full npm tree reported 49 advisories. The production tree reported 17: four high and thirteen moderate, with no critical vulnerabilities. Affected production dependency chains include Expo/Metro configuration tooling, React Router, `brace-expansion`, `postcss`, `shell-quote`, `uuid`, and `xcode`. Several fixes require version-changing upgrades rather than safe patch-only edits, so they were not applied automatically during this Android hardening request. Review and upgrade them in a dedicated dependency-update branch with regression testing.

## Secret scan result

The final tracked-source scan checked private-key headers, Stripe secret/webhook formats, Google API keys, AWS access keys, JWT-shaped tokens, RevenueCat secret-like keys, and tracked keystore/credential filenames. It found zero matching tracked files and zero tracked signing files. Example placeholders and documentation were excluded from the high-confidence scan to avoid treating non-secrets as credentials.
