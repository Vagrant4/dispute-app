# Final signing certificate report

## Status

**FAIL - SIGNED PRODUCTION AAB NOT GENERATED**

The approved EAS production command located the existing EAS-managed remote Android keystore, but the Free-plan monthly build limit stopped the job before a build entered the queue. No new production AAB was returned.

## Certificate verification

| Required field | Result |
| --- | --- |
| AAB path | Not available |
| `jarsigner` result | Not runnable on a production AAB |
| Certificate subject | Not available |
| Certificate issuer | Not available |
| Valid from/to | Not available |
| SHA-1 fingerprint | Not available |
| SHA-256 fingerprint | Not available |
| Android Debug subject absent | Not verifiable on a signed production artifact |
| Google Play upload-key match | OWNER VERIFICATION REQUIRED |
| Google Play app-signing fingerprint | OWNER VERIFICATION REQUIRED |

No private key, keystore, alias password, store password, or signing secret was downloaded or exposed.

## Local preflight artifact

The latest local AAB is:

`mobile/android/app/build/outputs/bundle/release/app-release.aab`

- SHA-256: `217AD6385C106CEDE24C2CAA118E312722EFA14B13E3868F2D9EF3AFDD30D75F`
- Signing result: `jar is unsigned`
- Purpose: release-configuration and bundle-content preflight only

Because it is unsigned, it is not signed with the Android debug certificate, but that fact does **not** prove correct production signing.

## Completion procedure

After a production EAS AAB is available, run:

```powershell
jarsigner -verify -verbose -certs app-production.aab
keytool -printcert -jarfile app-production.aab
```

Record only the certificate subject, issuer, validity dates, SHA-1, and SHA-256. The result must say `jar verified`, the subject/issuer must not be Android Debug, and the SHA-256 must match the Google Play upload certificate.
