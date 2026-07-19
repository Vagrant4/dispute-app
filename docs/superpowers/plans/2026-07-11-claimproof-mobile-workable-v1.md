# ClaimProof SG Workable Mobile V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish ClaimProof SG as a practical offline-first Expo app for Android and iOS, covering project selection through evidence, reporting, sharing, and backup.

**Architecture:** Extend the existing local SQLite repositories and thin screen orchestration rather than replacing the working web/server system. Shared domain calculations remain outside UI components; platform adapters handle browser versus native files, pickers, maps, and sharing.

**Tech Stack:** Expo 56, React Native, TypeScript, Expo SQLite, Expo FileSystem, Expo ImagePicker, Expo Location, Expo Print, Expo Sharing, Expo Crypto, Node test runner.

---

## Target Files And Responsibilities

- `mobile/src/work/workRepository.ts`: project selection, manual entries, and time-entry rules.
- `mobile/src/work/webWorkStore.ts`: browser-preview parity for work actions.
- `mobile/src/screens/HomeScreen.tsx`: live on-site workflow and selected project.
- `mobile/src/screens/WorkSetupScreen.tsx`: clients/projects and manual entry form.
- `mobile/src/screens/PhotoEvidenceScreen.tsx`: capture metadata, persist photos, and list evidence.
- `mobile/src/backup/backupFiles.ts`: durable native backup export, picker import, and sharing.
- `mobile/src/screens/SettingsBackupScreen.tsx`: user-facing backup and restore workflow.
- `mobile/App.tsx` and `mobile/src/screenContent.ts`: five-tab production navigation and nested settings tools.
- `mobile/src/styles.ts`: reusable field-tool tokens and component styles.
- `mobile/tests/*.test.js`: repository and source-contract regression coverage.
- `mobile/app.json`: Android/iOS permission and visual configuration.

### Task 1: Selected Project And Manual Time Entries

**Files:**
- Modify: `mobile/src/work/workRepository.ts`
- Modify: `mobile/src/work/webWorkStore.ts`
- Modify: `mobile/src/screens/HomeScreen.tsx`
- Modify: `mobile/src/screens/WorkSetupScreen.tsx`
- Test: `mobile/tests/workRepository.test.js`

- [ ] Add failing tests proving clock-in honors a selected project and manual entries persist the shared inclusive-break calculation.
- [ ] Run `npm.cmd run test --workspace mobile -- --test-name-pattern="WorkRepository"` and confirm the new assertions fail for missing behavior.
- [ ] Add a validated `createManualEntry` repository API and expose project lists to the Home screen.
- [ ] Add project selection to Today and a manual-entry form to Work, with explicit validation/status messages.
- [ ] Run mobile tests and typecheck; confirm the new behavior passes without changing existing time rules.

### Task 2: Persisted Photo Evidence Workflow

**Files:**
- Modify: `mobile/src/screens/PhotoEvidenceScreen.tsx`
- Modify: `mobile/src/photos/photoEvidenceRepository.ts` only if a focused query API is missing
- Test: `mobile/tests/photoEvidenceRepository.test.js`
- Test: `mobile/tests/screenContent.test.js`

- [ ] Add failing coverage for the project-owned evidence input used by the screen and its required fields.
- [ ] Run the focused mobile photo tests and confirm the missing screen contract fails.
- [ ] Add project selector, caption, evidence type, camera/gallery preview, optional GPS, explicit Save Evidence, recent evidence list, and owned deletion.
- [ ] Ensure cancellation and permission denial never create a database row or block other app features.
- [ ] Run mobile tests and typecheck.

### Task 3: Durable Backup And Restore

**Files:**
- Create: `mobile/src/backup/backupFiles.ts`
- Modify: `mobile/src/screens/SettingsBackupScreen.tsx`
- Modify: `mobile/package.json`
- Modify: `mobile/app.json`
- Test: `mobile/tests/backupFiles.test.js`

- [ ] Add failing adapter tests for durable JSON file creation, share fallback, picker cancellation, and validated overwrite restore.
- [ ] Run the focused backup test and confirm failure because the file adapter does not exist.
- [ ] Add Expo Document Picker, implement app-owned timestamped backup files, native share, document selection, preview, and explicit overwrite confirmation.
- [ ] Keep browser preview functional with download/upload adapters or a clear non-destructive fallback.
- [ ] Run backup tests, all mobile tests, and typecheck.

### Task 4: Production Navigation And Field UX

**Files:**
- Modify: `mobile/App.tsx`
- Modify: `mobile/src/screenContent.ts`
- Modify: `mobile/src/styles.ts`
- Modify: `mobile/src/screens/HomeScreen.tsx`
- Modify: `mobile/app.json`
- Test: `mobile/tests/screenContent.test.js`

- [ ] Add a failing source-contract test for the five production tabs and required disclaimer.
- [ ] Run the screen-content test and confirm failure against the ten-tab developer shell.
- [ ] Replace the horizontal developer tab rail with a five-item thumb-safe navigation bar; group secondary tools inside Settings.
- [ ] Strengthen clock hierarchy, active session state, empty states, accessibility labels, dark system appearance, and Android/iOS permission descriptions.
- [ ] Run mobile tests, typecheck, and Expo web export to catch bundling regressions.

### Task 5: Reports, Integration, And Release Verification

**Files:**
- Modify: `mobile/src/screens/ProgressClaimReportsScreen.tsx` if project/period selection is not already reliable
- Modify: `README.md`
- Create: `docs/test-runs/2026-07-11-mobile-workable-v1.md`

- [ ] Add or adjust a failing integration-level test for the intended report snapshot inputs before changing report orchestration.
- [ ] Verify PDF/CSV generation only archives durable files and exposes native Share.
- [ ] Run `npm.cmd run test --workspace mobile` and `npm.cmd run typecheck --workspace mobile`.
- [ ] Run `npm.cmd run test` and `npm.cmd run build` with enough time to capture complete output.
- [ ] Run Expo Android/iOS configuration or bundle validation available on this Windows machine and document physical-device checks that require the user’s phone or Apple signing environment.
- [ ] Record exact run commands, completed flow, remaining external-device checks, and current git status without discarding unrelated work.

## Plan Self-Review

The plan covers every item in the approved mobile completion flow and keeps cloud/billing/employer features excluded. Repository APIs precede UI orchestration, every behavioral change begins with a failing test, and platform-specific behavior is isolated behind adapters. No task requires replacing the existing web or server app.

