# Final Android release gate

## Overall status

**FAIL - DO NOT RELEASE**

| Release gate | Status | Evidence/action required |
| --- | --- | --- |
| Production AAB generated | **FAIL** | EAS quota stopped the build before queueing; no production AAB exists. |
| AAB signature verified | **FAIL** | No signed production AAB to run `jarsigner`/`keytool` against. |
| No Android debug certificate | **FAIL** | Correct production certificate cannot be proven without the signed artifact. |
| Package/version correct | **PASS** | Local release: `sg.claimproof.mobile`, `0.2.0`, code `2`. |
| Release manifest hardened | **PASS** | Local merged manifest: cleartext false, backup false, reduced permissions, no custom scheme. |
| Dev Client/Dev Menu absent | **PASS** | No release manifest/package-lock markers. |
| R8 and resource shrinking | **PASS** | Mapping and shrinker output produced. |
| Local AAB high-confidence secret scan | **PASS WITH NOTES** | No private/payment/service-account/token secret was found. React Native's inactive `http://localhost:8081/` framework fallback remains; the app API uses HTTPS and release cleartext is disabled. |
| Final signed AAB secret scan | **FAIL** | Signed artifact was not generated. |
| Google Play upload certificate matches | **OWNER VERIFICATION REQUIRED** | Supply App integrity upload-certificate SHA-256 and compare with production AAB. |
| Google Play app-signing certificate recorded | **OWNER VERIFICATION REQUIRED** | Supply App integrity app-signing SHA-256. |
| Play product IDs active | **OWNER VERIFICATION REQUIRED** | Confirm exact case-sensitive product IDs. |
| Subscription base plans active | **OWNER VERIFICATION REQUIRED** | Confirm price, countries, and active base plans. |
| Internal testing release uploaded | **OWNER VERIFICATION REQUIRED** | No internal-track evidence supplied. |
| License testers configured | **OWNER VERIFICATION REQUIRED** | No Play Console evidence supplied. |
| RevenueCat Android package correct | **OWNER VERIFICATION REQUIRED** | Confirm `sg.claimproof.mobile` in RevenueCat. |
| RevenueCat Google credentials connected | **OWNER VERIFICATION REQUIRED** | Dashboard evidence required. |
| RevenueCat products imported | **OWNER VERIFICATION REQUIRED** | Dashboard evidence required. |
| Current offering configured | **OWNER VERIFICATION REQUIRED** | Dashboard evidence required. |
| Entitlement mapped correctly | **OWNER VERIFICATION REQUIRED** | Dashboard evidence required. |
| RevenueCat product and entitlement IDs configured in EAS | **PASS** | `EXPO_PUBLIC_REVENUECAT_PRODUCT_ID` and `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` are present in the production environment. Values were not printed during verification. |
| RevenueCat Android public SDK key configured in EAS | **FAIL** | `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` is missing. Add the correct public app-specific `goog_` key; never substitute a placeholder or secret key. |
| New purchase activates entitlement | **OWNER VERIFICATION REQUIRED** | Internal-track test result required. |
| Restore purchase works | **OWNER VERIFICATION REQUIRED** | Restore action and entitlement validation are implemented and locally tested; an internal-track store-account result is still required. |
| Cancellation keeps access until expiration | **OWNER VERIFICATION REQUIRED** | Server regression test passes through period end and revokes after expiration; a live RevenueCat lifecycle result is still required. |
| Expiration revokes premium access | **OWNER VERIFICATION REQUIRED** | Lifecycle test result required. |
| Failed payment does not grant access | **OWNER VERIFICATION REQUIRED** | Lifecycle test result required. |
| Offline launch behaves safely | **OWNER VERIFICATION REQUIRED** | Device test result required. |
| Reinstall restores purchase | **OWNER VERIFICATION REQUIRED** | Device test result required. |
| Different account does not inherit entitlement | **OWNER VERIFICATION REQUIRED** | Multi-account device test required. |

## Next permitted build point

EAS states that the Free-plan Android build allowance resets on Saturday, 1 August 2026. A plan upgrade is an owner purchasing decision and was not made.

Before the next build, configure the missing RevenueCat Android public SDK key and recheck all three expected production names. Then request approval for exactly one new EAS production build, download the AAB, and replace every signing/final-artifact FAIL with evidence-backed results.
