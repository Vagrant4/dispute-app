# DISPUTE iOS test-build preparation

Prepared: 13 November 2026, 14:44:48 Asia/Singapore (UTC+08:00)  
Branch: `build/dispute-ios-20261113` (local only; not pushed)  
Preparation commit: `99fa452a6e16d816e5dcb6473a766f3fd639583d`  
Parent: `853fa61aa862cb10fd51ffbf088b952db8c611d0` (`build/dispute-test2-20261112`)

No cloud build, submission, signing, Apple login, credential creation, upload, deployment, RevenueCat dashboard change, or Google Cloud change was performed. A recoverable local bundle backup of the starting commit is beside the canonical worktree at `C:\Users\User 2024\Documents\Codex\2026-11-12-dispute-pay-policy\pre-ios-prep-853fa61.bundle`.

## App identity and Maps

- iOS bundle ID: `sg.claimproof.mobile`. Android production package remains `sg.claimproof.mobile`; the Android Test 2 variant remains `sg.claimproof.mobile.test2` through the Android-only `./plugins/withDisputeTest2Android` plugin. There is no iOS Test 2 bundle ID because Test 2 is an Android-only test variant and a second iOS app record would add unnecessary Apple/RevenueCat configuration.
- iOS marketing version remains `0.3.30`; iOS build number is now `32`, aligned with Android `versionCode` 32. Android version code and marketing version were not changed.
- The app renders native maps using `react-native-maps` with `PROVIDER_GOOGLE`, so iOS uses Google Maps rather than Apple Maps. Client code uses Expo/OS `Location.geocodeAsync` and `reverseGeocodeAsync`; it does not call Google Geocoding or Places HTTP APIs directly.
- `mobile/app.config.js` now wires `ios.config.googleMapsApiKey` from `GOOGLE_MAPS_IOS_API_KEY`, either as an environment variable or a named line in the ignored `mobile/.env.googlemaps`. Android keeps its existing `GOOGLE_MAPS_API_KEY` support, including the legacy bare-key local-file form. `mobile/.env.googlemaps.example` has empty placeholders only.

Shi/CEO must create a separate iOS Google Maps key in Google Cloud: enable **Maps SDK for iOS** and restrict that key to iOS apps with bundle ID `sg.claimproof.mobile`. Do **not** reuse the Android key. Geocoding API and Places API do not need to be enabled for this client key under the current code, because the app makes no direct Google Geocoding or Places requests. Put the value in `GOOGLE_MAPS_IOS_API_KEY=` in the local ignored file for local preparation, and later set the same named EAS environment variable for the selected build environment. Never commit the value.

## RevenueCat

The `react-native-purchases` SDK is already integrated. The client selects `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` on iOS and requires an `appl_` public key; product ID defaults to `dispute_basic_monthly`, and the entitlement ID comes from `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`. No SDK or billing code was added in this preparation.

For Shi's `vagrantpersonal@gmail.com` RevenueCat account, complete these later (no resources were created here):

- Use one RevenueCat project/app setup; create the iOS app entry for bundle ID `sg.claimproof.mobile`.
- Add the App Store Connect API / in-app-purchase key (`.p8`) and, if the current App Store Connect integration requires it, the App Store shared secret.
- Create entitlement `dispute_basic`, then an offering that exposes it.
- Later—not in this task—create the App Store Connect subscription product `dispute_basic_monthly` and attach it to the RevenueCat offering/entitlement.
- Add the resulting iOS public `appl_...` key as `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` in EAS environment configuration. The server-side webhook is already documented; do not create a new webhook here.

## EAS profiles and privacy text

`eas.json` now has these iOS-capable profiles:

- `development-simulator`: `distribution: internal`, development environment, development client, `ios.simulator: true`.
- `preview`: `distribution: internal`, preview environment, `ios.simulator: false` (an internal/ad-hoc device build, not TestFlight).
- `testflight`: `distribution: store`, production environment, remote credentials source, `autoIncrement: true`, `ios.simulator: false`. This is the build profile for a later TestFlight upload.
- `production`: remains `distribution: store`, `autoIncrement: true`, keeps the Android AAB setting, and now explicitly has `ios.simulator: false`.

Configured iOS permission strings, verbatim:

- `NSCameraUsageDescription`: `DISPUTE uses the camera when you choose to capture photo evidence.`
- `NSPhotoLibraryUsageDescription`: `DISPUTE lets you choose photo evidence from your library.`
- `NSLocationWhenInUseUsageDescription`: `DISPUTE uses your location for clock-in GPS proof and can attach it to work records or photo evidence. The app still works if you decline.`
- `NSMicrophoneUsageDescription`: `DISPUTE uses the microphone only when you choose voice search.`
- `NSSpeechRecognitionUsageDescription`: `DISPUTE uses speech recognition only when you choose voice search.`
- `ITSAppUsesNonExemptEncryption`: `false`.

`NSLocationAlwaysAndWhenInUseUsageDescription` is omitted because only foreground location methods are used; there is no background-location/task API. `NSPhotoLibraryAddUsageDescription` is omitted because reports are shared through the OS share sheet, not saved by the app to the photo library. The speech-recognition plugin strings match the microphone and speech wording above.

## Validation

- `npm run build --workspace @claimproof/shared`: passed.
- `npm run test --workspace mobile`: Node suite passed **373/373**. The initial component run timed out in an existing `settingsPayRate` test; rerunning with `--testTimeout=30000` passed **18 suites / 125 tests**. Total: **498 passed, 0 failed**. Jest retained its pre-existing open-handles notice after success.
- `npx expo config --type public --json`: completed with redacted placeholder Maps variables. A `--type prebuild` resolution check confirmed both native Maps fields receive their redacted placeholders; no real key was output or stored in this report.
- `npx expo-doctor`: **18/21 checks passed**. Findings: Expo detects the existing dynamic `app.config.js` plus `app.json` pattern; Expo SDK 56 has the documented Hermes V1 advisory; eight package versions are out of Expo's preferred range (including Jest 30 versus expected 29). These were pre-existing/dependency-maintenance findings and were not changed in this focused iOS configuration task.
- `expo prebuild --platform ios --no-install`: not re-run in a new scratch copy in this task (optional). No iOS compile is claimed. The prior isolated Windows check correctly reported: `Skipping generating the iOS native project files. Run npx expo prebuild again from macOS or Linux to generate the iOS project.`
- Android behavior was preserved: package/version `sg.claimproof.mobile` / 32, Android-only Test 2 plugin first, Test 2 signing pin untouched, blocked background-location permissions unchanged, and Android Maps key wiring remains compatible.

## Approval blockers and next command

In order, Shi must provide or complete:

1. Typed approval: **OK to run EAS build for iOS**.
2. Expo login on this PC if it is not already authenticated.
3. Apple sign-in with 2FA performed by Shi; no agent should receive or handle it.
4. The App Store Connect app record for `sg.claimproof.mobile` and the Apple Team ID.
5. The separate restricted iOS Maps key described above.
6. RevenueCat iOS app configuration and `appl_` public key; products/prices are created later in App Store Connect.

After those approvals and only from `mobile/`, the intended build command is:

```powershell
npx eas build -p ios --profile testflight
```

Only after a successful build and explicit authorization for Apple submission should a separate submit action be considered. It was not run here.

## Files changed

- `mobile/app.config.js`
- `mobile/app.json`
- `mobile/eas.json`
- `mobile/.env.googlemaps.example`
- `mobile/assets/icon-ios.png` (1024×1024, RGB/no alpha)
- `mobile/App.tsx`
- `mobile/src/screens/HomeScreen.tsx`
- `mobile/src/screens/ProjectsScreen.tsx`
- `mobile/src/screens/SettingsScreen.tsx`
- `mobile/tests/iosReadiness.test.js`

## iOS differences vs Android 0.3.30

This iOS preparation branch is based only on `853fa61aa862cb10fd51ffbf088b952db8c611d0` (the local DISPUTE Test 2 v0.3.30 commit). `99fa452a6e16d816e5dcb6473a766f3fd639583d` is its direct child; it was not rebased onto an older branch. Audit of `853fa61...99fa452` found only iOS configuration, the iOS icon, Maps iOS-key wiring, permission strings, iOS-readiness tests, and four `Platform.OS !== "android"` guards around Android `BackHandler` subscriptions. Those guards return before subscription on iOS and leave the prior Android listener and Android behaviour unchanged. No product, UI, calculation, pay-rule, or Android Test 2 change was found or made.

Lunch and dinner deductions, overtime and off-day/public-holiday multipliers, daily-pay conversion, time/project/photo evidence, reports, and all other product functions execute the same code path as `853fa61aa862cb10fd51ffbf088b952db8c611d0`. The native location map also remains the same `react-native-maps` `PROVIDER_GOOGLE` implementation. The following are platform presentation or store differences from the Android 0.3.30 Test 2 app, not changes to those functions or rules:

- **Platform permission dialogs — unavoidable OS presentation; wording is fixable.** iOS shows Apple permission sheets using the configured Camera, Photo Library, While Using Location, Microphone, and Speech Recognition strings. Android shows Android runtime prompts for its existing permissions. The requested actions are the same, but dialog wording, timing, and Settings recovery UI are controlled by each OS.
- **Map provider and rendering — partly unavoidable, partly fixable.** Both builds request Google Maps through `PROVIDER_GOOGLE`; iOS is wired to a separate Maps SDK for iOS key and Android keeps its Android key. The app uses a standard map, a fixed marker, and an accuracy circle—there is no marker clustering, no app-supplied dark map style, and no my-location control in this code. Google’s iOS and Android SDKs can render tiles, labels, gestures, and controls slightly differently; that is platform/SDK behaviour. Map options, clustering, a my-location button, or a custom dark style could be deliberately added later (fixable), but are not present now.
- **Background location — no difference in capability today.** Both builds are foreground-only: the code calls foreground permission/current-position APIs and contains no background-location task or watcher. Android also explicitly blocks background-location permissions. This is the same evidence behaviour on both platforms, not an iOS limitation.
- **File and PDF sharing sheet — unavoidable OS presentation; integration is fixable.** PDF/report sharing uses the same `expo-sharing` adapter and generated files, but iOS opens its system share sheet while Android opens Android’s chooser/share UI with different destinations and wording. The report contents and eligibility rules are unchanged; any app-specific export flow could be changed later.
- **Keyboard and pickers — unavoidable OS input behaviour; styling is fixable.** The app’s custom sheets and fields are shared, but the iOS keyboard and native text-input behaviour differ from Android. `KeyboardAwareScroll` intentionally uses iOS `padding` versus Android `height` to avoid covered inputs. OS keyboard details and accessibility semantics differ; custom layout/styling refinements could be made later.
- **Back navigation — unavoidable navigation convention; app handling is fixable.** Android Test 2 has a hardware Back button and its existing listeners close sheets, return to Home/login, or require a second press to exit. iOS has no Android hardware Back button and instead uses iOS navigation/back gestures where the OS provides them. The new guards only stop `BackHandler` registration on non-Android platforms, preventing an Android-only API from affecting iOS; Android retains exactly the previous listener logic. Any future in-app iOS back affordance would be a deliberate UI change.
- **Notifications — no difference in app functionality today.** There is no notifications feature or `expo-notifications` integration in this code. Android explicitly blocks `POST_NOTIFICATIONS`; iOS has no notification permission string/configuration. Adding notifications later would be a new, fixable product feature on both platforms.
- **Purchase flow — unavoidable store difference; shared access rules remain the same.** Both use the existing RevenueCat client and server entitlement checks, but Android purchases use Google Play/`goog_` configuration and iOS uses App Store/`appl_` configuration; management URLs also point to the respective store. The free trial still requires the user to have a DISPUTE account because entitlement status is user-account scoped. Trial/pay access rules are unchanged.
- **Fonts — partly unavoidable, partly fixable.** Material Icons are loaded from the same bundled font on both platforms. General text uses React Native/system font resolution, so iOS and Android glyph metrics/rasterisation can vary. Shipping a specific text font and applying it consistently would be a later fixable design choice.
- **Safe areas — unavoidable device geometry; layout is fixable.** The shared app already uses `react-native-safe-area-context`: iOS will reserve space for notches, the Dynamic Island, and home indicator, while Android insets vary by device/navigation mode. The existing edge handling is shared; any device-specific spacing tuning would be fixable later.

Packaging is intentionally different, not a pay-rule change: the Android Test 2 APK is labelled `DISPUTE Test 2` and uses application ID `sg.claimproof.mobile.test2`; this prepared iOS build uses app name `dispute` and bundle ID `sg.claimproof.mobile`. This follow-up does not create a second iOS bundle ID.
