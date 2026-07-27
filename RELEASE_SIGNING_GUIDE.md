# Android release signing guide

DISPUTE production signing uses protected EAS remote Android credentials and Google Play App Signing. No keystore, private key, password, or `credentials.json` file belongs in this repository.

## One-time owner setup

1. Sign in to the Expo account that owns `@vagrant4/claimproof-sg`.
2. Run `npx eas-cli credentials --platform android` from `mobile` and let EAS create or select the Android upload key. This is an account-owner operation.
3. Create the application `sg.claimproof.mobile` in Google Play Console and enroll it in Play App Signing.
4. Upload the first production AAB. Google Play keeps the app-signing key; EAS uses the upload key for later AABs.
5. Record only the public upload/app-signing certificate SHA-256 fingerprints in the release record. Never copy private key material into tickets or source control.

## Production build

From `mobile`, run:

```powershell
npx eas-cli build --platform android --profile production
```

The production EAS profile builds an Android App Bundle and uses `credentialsSource: remote`. Version 0.2.0 uses versionCode 2. Increase both values before every store release.

## Verification

After downloading the AAB:

```powershell
jarsigner -verify -verbose -certs .\dispute-production.aab
keytool -printcert -jarfile .\dispute-production.aab
```

The certificate must not be the Android debug certificate (`CN=Android Debug`). The final store-delivered APK is signed by Google Play's app-signing certificate, which can differ from the upload certificate shown on the AAB.

## Local builds and key handling

- The Gradle `release` build type has no debug signing configuration. A local release build is therefore unsigned unless signing credentials are injected outside version control.
- The local `mobile/android/app/debug.keystore` may exist for developer builds, but it is ignored and not tracked.
- `*.keystore`, `*.jks`, `*.p12`, `credentials.json`, and `mobile/android/keystores/` are ignored.
- Do not place passwords in Gradle files, shell history, EAS environment variables marked plain text, screenshots, or documentation.
- If an upload key is lost or exposed, follow the Google Play upload-key reset process. Exposure of an upload key does not require exposing or replacing the Google-held app-signing key.
