# Final AAB secret scan report

## Status

**LOCAL AAB PREFLIGHT: PASS WITH DEPENDENCY NOTE**
**SIGNED PRODUCTION AAB: NOT SCANNED - NOT GENERATED**

## Artifact scanned

- Path: `mobile/android/app/build/outputs/bundle/release/app-release.aab`
- SHA-256: `217AD6385C106CEDE24C2CAA118E312722EFA14B13E3868F2D9EF3AFDD30D75F`
- Signing: unsigned local release preflight
- Extracted files scanned: 698

## High-confidence scan results

| Category | Matching files |
| --- | ---: |
| Private-key header | 0 |
| JSON private key | 0 |
| Service-account JSON | 0 |
| Stripe live/test secret | 0 |
| Stripe webhook secret | 0 |
| Google API key | 0 |
| AWS access key | 0 |
| Bearer token | 0 |
| JWT-shaped token | 0 |
| `127.0.0.1:4000` API endpoint | 0 |
| Android emulator HTTP endpoint | 0 |
| `localhost:4000` API endpoint | 0 |
| Expo Dev Client/Launcher/Menu | 0 |
| `exp+claimproof-sg` | 0 |

No RevenueCat secret API key or Google service-account credential was found.

One React Native framework source constant, `http://localhost:8081/`, remains in the release JavaScript bundle as the standard development-server fallback used by React Native internals. Source-map inspection ties it to React Native's `DevServerInfo` helper, not to DISPUTE authentication or payment code. The application API path is hard-coded to the live HTTPS server when not in development, and the merged release manifest blocks cleartext traffic. This framework residue is recorded as a non-secret dependency note rather than an application endpoint.

Raw bundle regexes also produced apparent `Bearer ...` and `goog_...` strings because minified string-table entries are concatenated without source delimiters. Source-map inspection found no bearer token and no complete `goog_` SDK key; only the defensive `startsWith("goog_")` validation exists. The real Android RevenueCat key is still missing from EAS production.

## RevenueCat dependency note

RevenueCat SDK strings remain in the local bundle:

- `SimulatedStore`: obfuscation map, DEX, and JavaScript bundle
- `test_store`: DEX and JavaScript bundle
- `useAmazon`: JavaScript bundle

This does not represent an enabled payment route:

- `useAmazon` is explicitly configured as `false`;
- Test Store keys are rejected by the application;
- Amazon and simulated-store Android components are absent from the merged release manifest;
- production webhooks accept only Play Store/App Store production events.

The DEX/map symbols originate from the RevenueCat SDK dependency, while the JavaScript bundle also contains the defensive messages and configuration that disable those paths. This residual code should be rechecked after future RevenueCat SDK upgrades.

## Limitation

Because the EAS production build did not start, this is not a scan of the final signed AAB. The final release gate remains FAIL until the actual production artifact is scanned and its hash recorded.
