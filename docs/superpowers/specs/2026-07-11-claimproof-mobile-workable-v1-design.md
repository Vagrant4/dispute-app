# ClaimProof SG Workable Mobile V1 Design

## Outcome

ClaimProof SG will ship as an Expo application that runs from one TypeScript codebase on Android and iOS, while preserving the existing web MVP and API. The mobile V1 is a local-first field notebook for a solo Singapore worker: choose a project, record time, attach evidence, generate a progress claim, share it, and back up the device data.

The completion flow is:

```text
Choose project -> Clock in -> Add work details/photo -> Clock out -> Generate PDF/CSV -> Share -> Back up
```

A worker should be able to complete this flow in under three minutes, excluding time spent on the job.

## Approved Product Decisions

- Preserve Expo, React Native, SQLite, the existing server/web MVP, and the black/neon-lime direction.
- Keep V1 solo-worker-first, offline-first, and usable when GPS permission is denied.
- Treat break time as inclusive and deduct it from on-site duration.
- Store photos, generated reports, and backups in app-owned local storage.
- Keep evidence hashes deterministic with `expo-crypto` on mobile.
- Do not add cloud sync, employer approvals, MOM submission, CPF automation, AI analysis, or in-app payment collection.
- Keep the required disclaimer visible in Settings and generated reports.

## Mobile Information Architecture

The production tab bar has five destinations:

1. **Today** - selected project, live elapsed time, clock in/out, work description, inclusive break, GPS status, and recent entries.
2. **Work** - clients, projects, project creation, and manual time entry.
3. **Evidence** - camera/gallery capture, project selection, evidence type, caption, optional GPS, saved evidence list, and deletion.
4. **Reports** - period/project progress claim generation, local archive, PDF/CSV share, and deletion.
5. **Settings** - backup/restore, privacy and legal notices, storage diagnostics, evidence lock, trial notes, and inactive subscription information.

Developer and policy information stays accessible inside Settings instead of occupying the primary navigation.

## Architecture And Boundaries

- `mobile/src/work/` owns clients, projects, time entries, active project choice, and manual-entry validation.
- `mobile/src/photos/` owns imported image files, evidence metadata, optional GPS, and SQLite persistence.
- `mobile/src/reports/` owns immutable snapshots, PDF/CSV file creation, archive rows, sharing, and deletion.
- `mobile/src/backup/` owns JSON envelope validation, durable backup files, native sharing, and overwrite restore through a document picker.
- Screen components orchestrate repositories but do not duplicate time, pay, report, or backup calculations.
- Web preview adapters remain available where Expo native APIs are unavailable.

Large screens will be split where doing so reduces mixed responsibilities. No broad refactor is authorized outside the mobile completion flow.

## Data And Error Handling

All mobile records remain owned by the fixed local V1 user identity. Project and time-entry relationships are enforced by SQLite ownership keys. A clock-out cannot precede clock-in, and inclusive break minutes cannot exceed the on-site interval. Manual entries use the same shared calculation utilities as live entries.

Permission denial is non-blocking. The UI explains what was skipped and continues without GPS, camera, gallery, or native sharing. Durable exports are not added to the archive until file creation is verified. Restore requires an explicit overwrite confirmation and a valid ClaimProof backup envelope.

## Visual Direction

The UI uses an industrial field-tool aesthetic: near-black surfaces, neon-lime actions, high-contrast white text, compact status rails, large thumb-safe primary controls, and restrained motion. The active clock action is the visual anchor. Accessibility requirements include labelled inputs, visible disabled/focus states, minimum touch targets, readable contrast, and status text that does not rely on colour alone.

## Verification And Completion Criteria

- Repository tests cover project selection, live and manual entries, evidence persistence, report generation, durable backup export/import, and validation failures.
- Mobile TypeScript, mobile tests, the root test suite, and the root build pass.
- Expo can produce valid Android and iOS application bundles/configuration from the shared mobile project.
- Web and server behavior remain intact.
- Real-device-only checks (camera, native share sheet, GPS, and installation) are documented with exact steps if a physical device is not connected during this run.

