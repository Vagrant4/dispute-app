# Final Android manifest report

## Scope and status

**LOCAL RELEASE PREFLIGHT: PASS**
**SIGNED PRODUCTION AAB MANIFEST: NOT AVAILABLE**

The results below come from the final locally generated release merged manifest and corresponding unsigned AAB. The signed EAS production artifact could not be generated because of the EAS quota limit.

## Application identity

- Package: `sg.claimproof.mobile`
- Version name: `0.2.0`
- Version code: `2`
- Minimum SDK: 24
- Target SDK: 36
- `BuildConfig.DEBUG`: `false`
- `android:debuggable`: absent, therefore false by Android default

## Security attributes

- `android:usesCleartextTraffic="false"`
- `android:allowBackup="false"`
- `android:fullBackupContent="@xml/backup_rules"`
- `android:dataExtractionRules="@xml/data_extraction_rules"`

## Permissions

1. `android.permission.ACCESS_COARSE_LOCATION`
2. `android.permission.ACCESS_FINE_LOCATION`
3. `android.permission.CAMERA`
4. `android.permission.INTERNET`
5. `android.permission.ACCESS_NETWORK_STATE`
6. `com.android.vending.BILLING`
7. `sg.claimproof.mobile.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`

The seventh entry is an AndroidX-generated package-signature permission, not a user-granted broad permission.

Absent permissions include:

- `RECORD_AUDIO`
- `SYSTEM_ALERT_WINDOW`
- `READ_EXTERNAL_STORAGE`
- `WRITE_EXTERNAL_STORAGE`
- `USE_BIOMETRIC`
- `USE_FINGERPRINT`
- `VIBRATE`

## Exported components

| Type | Component | Protection/purpose |
| --- | --- | --- |
| Activity | `sg.claimproof.mobile.MainActivity` | Launcher activity. |
| Receiver | `androidx.profileinstaller.ProfileInstallReceiver` | Requires `android.permission.DUMP`. |

## Deep-link handlers

No custom `exp+claimproof-sg` filter or other custom authentication URI handler remains. `MainActivity` exports only the launcher intent filter.

## Development and payment-test components

The merged release manifest has zero matches for:

- Expo Dev Client, Dev Launcher, Dev Menu, or Metro;
- Amazon IAP receiver/proxy activity;
- RevenueCat simulated-store activity;
- Google Play billing test companion;
- custom Expo scheme.

## R8/resource shrinking

The release build produced:

- `mapping.txt`
- `configuration.txt`
- `seeds.txt`
- `usage.txt`
- `resources.txt`

These outputs confirm R8 and resource shrinking executed for the local release bundle.

This report must be repeated against the signed production AAB after EAS successfully builds it.
