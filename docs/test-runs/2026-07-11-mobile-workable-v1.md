# ClaimProof SG Mobile Workable V1 Test Run - 2026-07-11

## Automated Verification

- `npm.cmd run test`: passed.
  - Shared: 30 tests.
  - Server: 91 tests.
  - Client: 24 tests.
  - Mobile: 75 tests.
- `npm.cmd run build`: passed for shared, server, and web client.
- `npx.cmd expo-doctor`: 21/21 checks passed.
- Expo web export: passed.
- Expo Android Hermes export: passed (687 modules, 2 MB bundle).
- Expo iOS Hermes export: passed (690 modules, 2 MB bundle).

## Implemented Mobile Flow

1. Choose an existing project or create a client/project.
2. Clock in with a location note and optional GPS.
3. See live elapsed time and record the work description.
4. Add inclusive break minutes and clock out.
5. Add a manual past entry when needed.
6. Capture or choose a photo, assign project/type/caption, attach optional GPS, and persist it locally.
7. Generate immutable progress claim PDF/CSV files and open the native share sheet.
8. Export a durable JSON backup, share it off-device, choose a backup file, and explicitly confirm overwrite restore.
9. Finalize/lock evidence using deterministic Expo-compatible hashing.

## Physical Device Release Checklist

Run on at least one Android phone and one iPhone before store submission:

- Install through Expo Go or a signed internal build.
- Deny GPS and confirm clock/photo/report flows still work.
- Grant GPS and confirm coordinates are recorded and OpenStreetMap opens.
- Capture a camera photo and choose a gallery photo; restart the app and confirm both remain visible.
- Clock in, force-close, reopen, confirm the active session persists, then clock out.
- Generate PDF and CSV; share both through the native share sheet and open the received files.
- Export backup, create an extra record, restore the backup with overwrite confirmation, and verify the extra record is removed.
- Verify large controls, keyboard behavior, safe areas, dark theme, and readable text at device accessibility font sizes.
- Confirm the disclaimer appears in Settings and generated reports.

## External Account Boundary

Signed Android AAB and iOS IPA production builds require publisher-owned Expo/EAS, Google Play Console, Apple Developer, and App Store Connect credentials. No account creation, certificate acceptance, or store submission was performed in this local run.

