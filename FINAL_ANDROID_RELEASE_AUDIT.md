# Final Android release audit

## Verdict

**FAIL - NOT PRODUCTION-READY**

The code-side Android release hardening passed local verification, but the approved EAS production build did not start because the `vagrant4` account has exhausted its Free-plan Android builds for July 2026. EAS states that the allowance resets on Saturday, 1 August 2026. No new build record or signed production AAB was created.

The command found the existing EAS-managed Android keystore and uploaded the project archive, but quota validation stopped the operation before a build entered the queue. No paid build was started and no credential was exported.

## Inputs reviewed

- Local release AAB: `mobile/android/app/build/outputs/bundle/release/app-release.aab`
- `ANDROID_SECURITY_FIX_REPORT.md`
- `PERMISSION_MATRIX.md`
- `PAYMENT_CONFIGURATION_REVIEW.md`
- `SECURITY_VERIFICATION_RESULTS.md`
- Generated release manifest and `BuildConfig`
- EAS Android build list after the failed attempt

The local AAB is an **unsigned preflight artifact**, not the requested signed production artifact.

## EAS production attempt

Command:

```powershell
eas build --platform android --profile production --non-interactive --wait
```

Observed results:

- Production profile selected.
- `EXPO_PUBLIC_API_BASE_URL` loaded from `eas.json`.
- No production EAS variables with Plain text or Sensitive visibility were found.
- Native Android package configuration was used.
- EAS remote Android credentials and an existing managed keystore were found.
- A 284 MB project archive uploaded successfully.
- EAS rejected the job because the monthly Free-plan Android build allowance was exhausted.
- A subsequent read-only `eas build:list` confirmed there is no new production build; the newest records remain preview APKs from 19 July 2026.

## Technical audit results

| Area | Status | Evidence |
| --- | --- | --- |
| Package/version | PASS | `sg.claimproof.mobile`, version `0.2.0`, versionCode `2`. |
| Debug state | PASS | Local release `BuildConfig.DEBUG=false`; no release `android:debuggable=true`. |
| Cleartext | PASS | Local release merged manifest has `usesCleartextTraffic=false`. |
| Backup protection | PASS | `allowBackup=false`; strict backup/data-extraction exclusions attached. |
| Permissions | PASS | Only the approved feature permissions plus AndroidX package-signature protection remain. |
| Deep links | PASS | No custom URI scheme or browsable authentication handler remains. |
| Dev modules | PASS | No Expo Dev Client, Dev Launcher, Dev Menu, or Metro marker in the release manifest. |
| R8/resource shrinking | PASS | Mapping, usage, seeds, and resource-shrinking outputs exist. |
| Local AAB secret scan | PASS WITH NOTES | No high-confidence secrets or application local/test API endpoint was found. React Native's inactive `http://localhost:8081/` development-server fallback and RevenueCat test-store symbols remain as dependency code. |
| Production AAB generation | FAIL | EAS quota stopped the build before queueing. |
| Production AAB signature | FAIL | No signed production AAB exists to inspect. |
| Google Play certificate match | OWNER VERIFICATION REQUIRED | Requires Play Console App integrity evidence. |
| Google Play Billing products | OWNER VERIFICATION REQUIRED | Requires product/base-plan/price/country/license-test evidence. |
| RevenueCat production configuration | FAIL / OWNER VERIFICATION REQUIRED | Product and entitlement identifiers are now present in EAS production, but the Android public SDK key is missing and dashboard configuration remains unverified. |
| Live purchase lifecycle | OWNER VERIFICATION REQUIRED | No internal-track purchase matrix results supplied. |

## Comparison with original APK audit findings

| Finding | Status |
| --- | --- |
| Debug certificate used for release | Source/config fixed; final signed-certificate verification **FAILS because no production AAB exists**. |
| Global cleartext enabled | PASS locally. |
| Backup enabled | PASS locally. |
| Expo development modules | PASS locally. |
| Mixed/test payment surfaces | Active routes disabled; dashboard configuration and final store build remain unverified. |
| Broad permissions | PASS locally. |
| Custom Expo URI scheme | PASS locally; removed. |
| Single-ABI APK | PASS locally through AAB packaging. |
| Limited obfuscation | PASS locally through R8 output. |
| Old version/code | PASS: `0.2.0` / `2`. |

## Required next actions

1. After 1 August 2026, or after the owner upgrades the EAS plan, obtain approval for one new production build.
2. Add the correct RevenueCat Android public SDK key beginning with `goog_` to the EAS production environment. The product and entitlement identifiers are already present.
3. Download the generated AAB and complete `FINAL_SIGNING_CERTIFICATE_REPORT.md` with its public certificate details.
4. Match the AAB upload certificate SHA-256 to Google Play Console.
5. Complete the Play/RevenueCat owner checks and internal testing matrix in `FINAL_RELEASE_GATE.md`.

Do not submit or publicly release the application while any final gate remains FAIL or OWNER VERIFICATION REQUIRED.
