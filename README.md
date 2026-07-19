# ClaimProof SG

ClaimProof SG is a mobile-first evidence app for Singapore freelancers and workers. It helps a worker record time, project activity, photo evidence, pay summaries, progress claim reports, and dispute support material.

This app is MOM-aware, but it is not a legal payroll or compliance system.

> This app helps you record work, time, pay, and evidence for reference. It does not replace legal, accounting, or MOM advice.

## Project Structure

```text
client/                 React + TypeScript + Vite app
  src/api/              Typed API helpers
  src/auth/             Cookie-auth session context
  src/components/       Shared UI components, clock panel, map preview
  src/layout/           Mobile-first app shell
  src/pages/            V1 app screens
server/                 Express + Prisma API
  prisma/               SQLite schema, migration SQL, seed data
  src/modules/          Auth, profile, companies, projects, time, photos, pay, reports, settings
  src/utils/            Time, pay, and report snapshot utilities
  tests/                Server unit/API tests
mobile/                 Expo Android/iOS app
  src/work/             Offline clients, projects, live/manual time entries
  src/photos/           Local photo evidence, metadata, and optional GPS
  src/reports/          Immutable progress claim PDF/CSV export and sharing
  src/backup/           Durable JSON backup and overwrite restore
docs/                   Product, API, database, and build docs
```

## Run Locally

Install dependencies:

```bash
npm install
```

Set a local SQLite database URL before database/server commands:

```powershell
$env:DATABASE_URL='file:./dev.db'
```

Run database migration:

```powershell
npm.cmd run db:migrate --workspace server
```

If Prisma reports schema-engine trouble in this Windows environment, apply the checked-in SQL directly:

```powershell
npm.cmd exec --workspace server -- prisma db execute --schema prisma\schema.prisma --file prisma\migrations\20260607000000_init\migration.sql
```

Seed demo data:

```powershell
npm.cmd run db:seed --workspace server
```

Start the app:

```powershell
npm.cmd run dev
```

Default URLs:

- Client: `http://localhost:5173`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/health`

## Run The Android / iOS App

Start Expo from the repository root:

```powershell
npm.cmd run start --workspace mobile -- --tunnel --clear
```

Then scan the QR code with Expo Go on Android, or with the iPhone camera/Expo Go on iOS. The phone flow is:

```text
Choose project -> Clock in -> Add details/photo -> Clock out -> Generate PDF/CSV -> Share -> Back up
```

The mobile V1 stores records locally on the device. Export a JSON backup before uninstalling, clearing app data, or changing phone.

## Demo Login

- Email: `demo@claimproof.sg`
- Password: `Password123!`

## Verification

Current verification passed:

```powershell
npm.cmd run test
npm.cmd run build
```

Results:

- Shared tests: 30 passed
- Server tests: 91 passed
- Client tests: 24 passed
- Mobile tests: 75 passed
- Server build: passed
- Client production build: passed
- Expo Doctor: 21/21 checks passed
- Android Hermes bundle: passed
- iOS Hermes bundle: passed
- Seed command: passed on a fresh local SQLite verification database
- PDF export: implemented server-side and downloadable from Progress Claims
- CSV export: implemented server-side and downloadable from Progress Claims

## Completed Features

- Email/password authentication with HTTP-only cookie session.
- Worker profile page.
- Clients / Companies CRUD.
- Projects CRUD with status badges.
- Dashboard with realtime clock status, active entry duration, GPS-aware clock-in/out, and summary counters.
- Manual time entries, including overnight work support and inclusive break minutes.
- Leaflet map preview for clock-in and clock-out GPS pins.
- Photo evidence upload, list, delete, evidence type, captions, optional GPS.
- Pay summary generation and MOM-aware itemised display.
- Progress claim generation with PDF and CSV downloads.
- Settings for standard daily hours, weekly hours, overtime multiplier, and default currency.
- Admin placeholder route only.
- Offline-first Expo app for Android and iOS with five field-work destinations.
- Mobile project selection, live clock, manual entries, and inclusive break calculation.
- Mobile project-owned photo capture/gallery evidence with optional GPS.
- Mobile durable PDF/CSV reports, native share, JSON backup, picker restore, and Evidence Lock.
- Seed data for one freelancer, one client, projects, time entries, photo evidence placeholders, pay summary, and progress claim report.

## Placeholder Features

V1 intentionally keeps these as placeholders only:

- CPF automation
- MOM rule engine / MOM submission
- Stripe subscription billing
- GPS verification
- Work Permit expiry reminder
- AI OCR
- AI photo analysis
- Employer approval workflow
- Admin dashboard

## Known Limitations

- SQLite and local file storage are used for V1.
- This is not a statutory payroll system and does not automate CPF or MOM compliance.
- Photo storage is local to the server machine.
- Browser GPS permission is optional; clock-in/out continues without GPS if permission is denied.
- App Store/Play Store signing and submission require the owner Apple/Google/Expo accounts and are not performed by the local source build.
- Prisma `migrate dev/deploy` may hit schema-engine issues in this Windows workspace; use the checked-in SQL command above if needed.
- Existing local `dev.db` files with no Prisma migration history may report drift; use a fresh SQLite file or reset only when you are comfortable deleting local data.

## Release Preparation Still Requiring Owner Accounts

1. Create Expo/EAS, Apple Developer, and Google Play Console projects owned by the publisher.
2. Add final app icon, splash artwork, screenshots, support URL, and privacy-policy URL.
3. Run the physical-device checklist in `docs/test-runs/2026-07-11-mobile-workable-v1.md`.
4. Produce signed AAB/IPA builds and submit them through the owner store accounts.
