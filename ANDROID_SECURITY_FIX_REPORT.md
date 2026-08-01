# Android production security fix report

## Status

The source-level and locally verifiable Android fixes are implemented on branch `codex/android-production-security-fixes`. The release is **not yet production-ready** because the newly built AAB is intentionally unsigned and the Google Play/RevenueCat production dashboards have not been verified. No completion claim is made for those external gates.

The 1 August 2026 follow-up also implements Google Play account-deletion and privacy compliance: authenticated in-app deletion, a public web deletion form, a public privacy policy, server and local data cleanup, an anonymous deletion receipt, subscription-management warning, tests, and version `0.3.0` / code `3`. These routes still require production server deployment and live URL verification.

## Files changed

- `.gitignore`
- `client/src/pages/RegisterPage.test.tsx`
- `client/src/pages/SettingsPage.tsx`
- `mobile/android/app/build.gradle`
- `mobile/android/app/debug.keystore` (removed from version control; local ignored copy retained)
- `mobile/android/app/src/main/AndroidManifest.xml`
- `mobile/android/app/src/main/res/values/colors.xml`
- `mobile/android/app/src/main/res/xml/backup_rules.xml`
- `mobile/android/app/src/main/res/xml/data_extraction_rules.xml`
- `mobile/android/gradle.properties`
- `mobile/app.json`
- `mobile/eas.json`
- `mobile/eslint.config.js`
- `mobile/package.json`
- `mobile/src/auth/remoteAuth.ts`
- `mobile/src/screens/HomeScreen.tsx` (business behavior unchanged; scoped lint explanation only)
- `mobile/src/screens/SettingsScreen.tsx`
- `mobile/src/subscription/subscriptionClient.ts`
- `mobile/tests/androidProductionSecurity.test.js`
- `mobile/tests/subscriptionClient.test.js`
- `package-lock.json`
- `server/src/config/env.ts`
- `server/src/modules/subscription/subscription.routes.ts`
- `server/src/modules/subscription/subscription.service.ts`
- `server/tests/env.test.ts`
- `server/tests/subscription.test.ts`
- `ANDROID_SECURITY_FIX_REPORT.md`
- `PAYMENT_CONFIGURATION_REVIEW.md`
- `PERMISSION_MATRIX.md`
- `RELEASE_SIGNING_GUIDE.md`
- `SECURITY_VERIFICATION_RESULTS.md`
- `FINAL_ANDROID_RELEASE_AUDIT.md`
- `FINAL_MANIFEST_REPORT.md`
- `FINAL_RELEASE_GATE.md`
- `FINAL_SECRET_SCAN_REPORT.md`
- `FINAL_SIGNING_CERTIFICATE_REPORT.md`

The client registration test was corrected because the repository's current secure-signup implementation already sends full name and mobile number during registration and does not call an authenticated profile endpoint before verification. The stale test caused the required full-suite verification to fail; no registration business behavior was changed in this branch.

## Audit findings fixed

### F-01 - Debug signing certificate

Partially fixed and fail-closed:

- Removed the release build's `signingConfigs.debug` assignment.
- Removed `mobile/android/app/debug.keystore` from version control and ignored signing-material formats.
- Configured EAS production for remote credentials and AAB output.
- Local release artifacts are unsigned, never debug-signed.

Not closed until the signed EAS production AAB is built and verified with a non-debug upload certificate, then Google Play App Signing is confirmed.

### F-02 - Cleartext traffic

Fixed:

- Production merged manifest has `android:usesCleartextTraffic="false"`.
- Production EAS API endpoint is HTTPS.
- Mobile authentication accepts an HTTP override only in a development runtime; release falls back to the live HTTPS endpoint.
- Production server configuration rejects a non-HTTPS `SERVER_PUBLIC_URL`.
- Debug manifest may use cleartext for local development without weakening release.

### F-03 - Backup exposure

Fixed:

- `android:allowBackup="false"` in source and final merged release manifest.
- Strict Android 11 and Android 12+ rules exclude every root, file, database, shared-preference, external, and device-protected domain from cloud backup and device transfer.
- This covers SQLite databases, SecureStore/authentication data, evidence photos, reports, location records, and user documents held in app storage.

### F-04 - Development modules and permissions

Fixed:

- Removed `expo-dev-client` and lockfile dependencies for Dev Client, Dev Launcher, Dev Menu, manifests, and related dev packages.
- Removed the dev-client network-inspector Gradle property.
- Final merged release manifest has no dev launcher/menu/Metro markers.
- Generated release `BuildConfig.DEBUG=false`; `android:debuggable` is absent/default false.

### F-05 - Mixed/test payment surfaces

Code fixed; dashboards remain unverified:

- RevenueCat client rejects Test Store keys and requires Google/App Store public SDK keys.
- Amazon mode, diagnostics, and automatic identifier collection are disabled.
- Production manifest removes Amazon IAP, RevenueCat simulated-store, and billing-test companion components.
- Server requires the configured product and entitlement, allows only Play/App Store events, rejects sandbox events in production, and rejects unsupported event types.
- Production server rejects Stripe test/live billing modes.
- No payment secret belongs in the mobile application.

### F-06 - Broad permissions

Fixed. The final release permissions are the six feature permissions and one AndroidX-generated signature permission listed in `PERMISSION_MATRIX.md` and `SECURITY_VERIFICATION_RESULTS.md`. Audio, overlay, legacy storage, biometric/fingerprint, and vibration permissions are absent.

### F-07 - Custom Expo scheme

Fixed. The unused `exp+claimproof-sg` filter was removed. The final launcher activity has no custom authentication deep link. No unaudited token/state/nonce flow remains. A future authentication link must use a verified HTTPS Android App Link and validate state, nonce, destination, expiry, and one-time use.

### F-08 - Single-ABI APK

Fixed for distribution. Production output is an Android App Bundle containing native support for `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`; Google Play will generate optimized device APKs. The local universal inspection APK is not the store deliverable.

### F-09 - Limited obfuscation

Fixed. Release builds use R8 optimization (`proguard-android-optimize.txt`), code shrinking, obfuscation, and resource shrinking. Final outputs include a 34 MB mapping file plus resources/seeds/usage reports, proving R8 executed.

### F-10 - Version 0.1.0 / code 1

Fixed. Application version is `0.2.0`; Android version code is `2` in Expo config, package metadata, Gradle, and the built release artifacts.

## Additional release hardening

- Debug/preview EAS APKs run `assembleDebug` and are visibly distinct: package `sg.claimproof.mobile.test`, version suffix `-test`, and label `DISPUTE Test`.
- RevenueCat MainActivity purchase-resume behavior uses `singleTop`, not `singleTask`.
- The local debug keystore is retained only as an ignored developer file.
- Fast source regression tests cover release config, forbidden manifest surfaces, backup rules, signing-material ignores, secure API selection, product/entitlement enforcement, store allow-listing, and production sandbox rejection.

## Findings not fixed and why

1. **Signed production AAB / Play App Signing:** After explicit approval for one EAS build, the command found the remote keystore and uploaded the project but EAS rejected the job because the Free-plan Android build allowance is exhausted until 1 August 2026. No production build record or signed AAB was created. The local AAB remains intentionally unsigned.
2. **Google Play product state:** Product activation, price/countries, license testers, and Play App Signing enrollment require the owner account and cannot be proven from source.
3. **RevenueCat dashboard state:** The product and entitlement identifiers are present in EAS production, but the Android public SDK key is missing. Offering mapping, Google credentials, webhook URL/secret, and purchase lifecycle tests still require the owner dashboard/device.
4. **Dependency advisories:** npm reported 17 production advisories (4 high, 13 moderate; 0 critical). Fixes span framework/transitive version changes and were not auto-applied because that would be a separate, potentially business-impacting migration.
5. **Lint warnings:** Expo lint passes with 0 errors and 12 existing warnings. They are outside the security scope and do not change the release result.

## Final permissions

- `android.permission.ACCESS_COARSE_LOCATION`
- `android.permission.ACCESS_FINE_LOCATION`
- `android.permission.CAMERA`
- `android.permission.INTERNET`
- `android.permission.ACCESS_NETWORK_STATE`
- `com.android.vending.BILLING`
- `sg.claimproof.mobile.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (AndroidX package-signature protection)

See `PERMISSION_MATRIX.md` for feature justification.

## Final exported components

- `sg.claimproof.mobile.MainActivity` - launcher activity.
- `androidx.profileinstaller.ProfileInstallReceiver` - protected by `android.permission.DUMP`.

No custom-scheme, Amazon IAP, simulated-store, or Expo dev component is exported.

## Final signing certificate summary

- No keystore, private key, password, signing secret, or production token is tracked.
- The current local AAB is unsigned. The generated debug APK is separately identified as `sg.claimproof.mobile.test` / `DISPUTE Test` and uses only the local Android Debug certificate.
- The current local release artifact is not signed by the Android debug certificate.
- The production upload certificate and Google Play app-signing certificate remain to be verified after the approved EAS/Play workflow. Only public certificate fingerprints should be recorded.

## Remaining production risks

- A store release must not proceed until the signed AAB and both payment dashboards pass the external checks above.
- Subscription purchase, restore, renewal, cancellation, expiration, and billing-issue behavior still requires Play license-test execution on a physical device.
- The npm production advisory backlog requires a dedicated upgrade/test cycle.
- Evidence is protected from Android backup, but application-level encryption at rest for every evidence file/database was not added by this request. Device compromise or a rooted device remains outside the backup controls.
- Removing the unused custom scheme means future email/auth deep links need a separately designed verified HTTPS App Link flow.

Detailed command outputs, artifact hashes, test totals, and intermediate failures are in `SECURITY_VERIFICATION_RESULTS.md`.
