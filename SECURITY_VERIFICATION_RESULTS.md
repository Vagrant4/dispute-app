# Android security verification results

## 4 August 2026 pre-deployment verification

The release branch was reinstalled from the lockfile with npm `10.9.4` and install scripts disabled, then built through the normal root command. The server now generates Prisma Client automatically in its `prebuild` and `pretest` hooks, closing the clean-install reproducibility gap without adding a repository-wide install hook.

- Root production build: passed after the clean install.
- Shared tests: 30/30 passed.
- Server tests: 136/136 passed across 15 files using one worker to avoid Windows SQLite lock contention.
- Client tests: 24/24 passed.
- Mobile tests: 121/121 passed.
- Mobile typecheck: passed.
- Expo Doctor: 20/20 passed.
- Expo lint: 0 errors and 13 warnings.
- Prisma schema validation: passed.
- Tracked-source secret scan: no production credentials or signing material found; matches were limited to dummy values in tests.
- Production dependency audit: 15 advisories (0 critical, 3 high, 12 moderate). Safe updates fixed `brace-expansion`, `ip-address`, `postcss`, and `nanoid`; `react-router-dom` is pinned to `7.18.2`. The remaining React Router high advisory affects RSC action mode, which this BrowserRouter-only client does not use. The remaining `shell-quote` and `uuid` findings are transitive React Native/Expo build-tool dependencies; breaking framework overrides were not applied.

Independent review found and closed three Android pilot gaps: production can now accept Google Play license-tester sandbox events only behind the explicit `REVENUECAT_ALLOW_SANDBOX_EVENTS` flag; the mobile report screen now exposes project-specific CSV as well as PDF export; and the referral migration backfills phone claims only for active, email-verified users. Referral relationship ownership is explicitly scoped, and Settings now reuses the shared subscription-access hook.

The initial grouped server command timed out because its three-minute wrapper was shorter than the database-backed suite and left a child process holding `server/prisma/test.db`. A later report test exceeded the old 20-second integration-test timeout and continued asynchronous work into the next test. The failing report file passed twice after setting realistic bounded integration timeouts, and the final deterministic full run passed all 136 server tests in 231.20 seconds.

Live Render inspection found that `dispute-api-live` has no persistent disk attached even though `render.yaml` declares one. The current `/var/data/dispute.db` therefore cannot be treated as recoverably backed up. Merge and deployment remain blocked until the existing database is safely exported and a persistent disk or managed database is configured. Adding a Render disk is a billed action and was not performed.

## 1 August 2026 compliance follow-up

The mandatory Google Play account-deletion and privacy paths were added after the original hardening audit. The app is now version `0.3.0` / Android code `3`.

- Focused auth/deletion API: 23/23 passed, including RevenueCat customer erasure, password-bypass regression coverage, anonymous receipt status, and staged-file cleanup retry.
- Full workspace: shared 30/30, server 123/123, client 24/24, mobile 117/117.
- TypeScript: server build and mobile typecheck passed.
- Expo Doctor: 20/20 after updating Expo from `56.0.17` to the compatible `56.0.18` patch.
- Expo lint: 0 errors and the same 12 pre-existing warnings.
- Local production-environment `bundleRelease`: passed.
- Local unsigned AAB: 40,279,228 bytes; SHA-256 `217AD6385C106CEDE24C2CAA118E312722EFA14B13E3868F2D9EF3AFDD30D75F`.
- Signing result: intentionally unsigned; a signed EAS AAB is still required.
- Merged manifest: version `0.3.0` / code `3`, `BuildConfig.DEBUG=false`, `allowBackup=false`, `usesCleartextTraffic=false`, expected seven permissions, and zero dev/test/custom-scheme markers.
- Secret scan: 0 high-confidence source matches and 0 tracked signing/credential files.
- Dependency audit: full tree 30 advisories (0 critical, 7 high, 22 moderate, 1 low); production tree 17 advisories (0 critical, 4 high, 13 moderate).
- EAS production variables: product ID and entitlement ID present; Android RevenueCat public SDK key absent.

The local privacy and deletion routes pass integration tests but are not live until the server revision and migration are deployed. `SUPPORT_EMAIL` must be set to an approved public support address before that deployment is treated as Play-ready.

The Expo `56.0.18` patch is an intentional compatibility-only release adjustment required for Expo Doctor 20/20; no feature-level SDK migration was performed.

Independent review follow-up removed receipt-ID password bypass behavior, added lost-response reconciliation through a rate-limited anonymous status endpoint, added durable/scheduled staged-file cleanup retries, centralized confirmation and HTML escaping helpers, and documented the anonymous-receipt ownership exception.

Verification was run on branch `codex/android-production-security-fixes` from fixed point `main` (`56213ba`). The original source project was used. No decompiled APK source was used to implement the fixes.

## Result summary

| Check | Result | Evidence |
| --- | --- | --- |
| Clean dependency installation | PASS | npm 10.9.4 lock-only install, `ci --dry-run`, and full `ci` completed; 1,473 packages installed. |
| Expo project health | PASS | `expo-doctor` passed 20/20 checks after replacing the legacy splash field, aligning SDK 56 patch versions, and documenting the intentionally maintained native-project configuration. |
| Type checking | PASS | Mobile TypeScript check and server TypeScript build completed with exit code 0. |
| Linting | PASS WITH WARNINGS | Expo lint completed with 0 errors and 12 pre-existing warnings. |
| Unit tests | PASS | Final full workspace run: shared 30/30, server 123/123, client 24/24, and mobile 117/117. Focused auth/deletion passed 23/23. |
| Android release AAB build | PASS | Optimized `bundleRelease` completed and produced `app-release.aab`. |
| Android debug APK build | PASS | Final `assembleDebug` completed and produced `sg.claimproof.mobile.test` / `DISPUTE Test`, signed only with the local Android Debug certificate. |
| Merged release manifest | PASS | Inspected generated release manifest; final permissions and exported components are below. |
| Release debug state | PASS | Generated `BuildConfig.DEBUG = false`; `android:debuggable` is absent, therefore false by platform default. |
| Cleartext and backup state | PASS | Merged manifest has `usesCleartextTraffic=false` and `allowBackup=false`, with strict backup/data-extraction rules attached. |
| Dev/test module markers | PASS | Zero merged-manifest matches for Expo dev launcher/menu, Metro, Amazon IAP, RevenueCat simulated store, or billing test companion. |
| Local signing check | EXPECTED FAIL / BLOCKER | The current local AAB is unsigned by design and contains no debug certificate. The debug certificate appears only on the clearly marked test APK. The approved EAS attempt was rejected before queueing because the monthly Android build allowance is exhausted. |
| Dependency vulnerability scan | COMPLETED / FINDINGS | Full npm tree: 30 advisories (0 critical, 7 high, 22 moderate, 1 low). Production tree: 17 advisories (0 critical, 4 high, 13 moderate). No force or breaking dependency upgrades were made. |
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
- After the Expo patch alignment and deletion-recovery review fixes, the clean Gradle child completed after the command wrapper reached its 15-minute timeout. The exact final reviewer-approved source then completed `bundleRelease` successfully in 119 seconds.
- A separate debug/test APK build reached the 10-minute timeout after producing its merged debug manifest and generated resources. Those outputs prove package `sg.claimproof.mobile.test`, cleartext/debuggable debug-only behavior, and label `DISPUTE Test`, but no final debug APK is claimed.
- The final combined `assembleDebug bundleRelease` command later completed successfully and produced the debug APK described below, closing that intermediate gap.
- A parallel server test run left a Vitest process holding `server/prisma/test.db`. The verified orphan process was stopped; focused auth/deletion passed 23/23 and the final full server suite passed 123/123.

## Final release artifact hashes

- AAB: `mobile/android/app/build/outputs/bundle/release/app-release.aab`
  - Size: 40,279,228 bytes
  - SHA-256: `217AD6385C106CEDE24C2CAA118E312722EFA14B13E3868F2D9EF3AFDD30D75F`
- Debug test APK: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`
  - Size: 148,315,774 bytes
  - SHA-256: `ADB2C27F2D6252C4377BAFFCADD54A2E5939FA3BD0B9ECF8278C88C690978C7C`

The debug APK is for device testing only. The local unsigned AAB is a preflight artifact and must not be distributed as a production release.

## Final merged-manifest security state

- Package: `sg.claimproof.mobile`
- Version: `0.3.0`
- Version code: `3`
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

After aligning Expo SDK 56 patch versions, the current full npm tree reported 30 advisories: seven high, twenty-two moderate and one low, with no critical vulnerabilities. The production tree reported 17: four high and thirteen moderate. Several fixes require version-changing upgrades rather than safe patch-only edits, so they were not applied automatically during this Android hardening request. Review and upgrade them in a dedicated dependency-update branch with regression testing.

## Secret scan result

The final tracked-source scan checked private-key headers, Stripe secret/webhook formats, Google API keys, AWS access keys, JWT-shaped tokens, RevenueCat secret-like keys, and tracked keystore/credential filenames. It found zero matching tracked files and zero tracked signing files. Example placeholders and documentation were excluded from the high-confidence scan to avoid treating non-secrets as credentials.
