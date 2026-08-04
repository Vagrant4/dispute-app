# Android permission-to-feature matrix

This matrix describes the intended production permission surface for DISPUTE 0.2.0 (versionCode 2). The final merged-manifest result is recorded in `SECURITY_VERIFICATION_RESULTS.md` after the release build.

| Permission | Feature | Runtime request | Production decision |
| --- | --- | --- | --- |
| `android.permission.CAMERA` | Capture photo evidence | Yes, only when the user starts capture | Keep |
| `android.permission.ACCESS_COARSE_LOCATION` | Attach approximate location to time/evidence records | Yes, optional | Keep |
| `android.permission.ACCESS_FINE_LOCATION` | Attach precise location/address when the user requests it | Yes, optional | Keep |
| `android.permission.INTERNET` | Registration, login, email verification, subscription refresh, server synchronization | No | Keep |
| `android.permission.ACCESS_NETWORK_STATE` | Detect whether a server/subscription refresh can be attempted | No | Keep |
| `com.android.vending.BILLING` | Google Play subscription purchase through RevenueCat | No | Keep |

The following permissions are explicitly removed from the production merged manifest:

| Permission | Reason removed |
| --- | --- |
| `android.permission.RECORD_AUDIO` | DISPUTE captures still-photo evidence; it does not record audio. |
| `android.permission.SYSTEM_ALERT_WINDOW` | Production UI does not draw over other apps. Debug tooling may request it only in the debug manifest. |
| `android.permission.READ_EXTERNAL_STORAGE` | App-scoped storage and Android document/photo pickers are used instead of legacy broad storage access. |
| `android.permission.WRITE_EXTERNAL_STORAGE` | App-scoped storage and Android share/document APIs are used instead of legacy broad storage access. |
| `android.permission.USE_BIOMETRIC` | No biometric authentication feature is implemented. |
| `android.permission.USE_FINGERPRINT` | No fingerprint authentication feature is implemented. |
| `android.permission.VIBRATE` | No application feature requires vibration. |

Android and dependency tooling may add a package-scoped signature permission used by AndroidX profile installation. It is not callable by unrelated applications and is documented separately in the final merged-manifest results.

Location and camera access remain optional at runtime. Denying them must not prevent manual project/time entry or access to already stored records.
