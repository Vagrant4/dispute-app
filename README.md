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

- Server tests: 108 passed
- Client tests: 24 passed
- Server build: passed
- Client production build: passed
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
- Prisma `migrate dev/deploy` may hit schema-engine issues in this Windows workspace; use the checked-in SQL command above if needed.
- Existing local `dev.db` files with no Prisma migration history may report drift; use a fresh SQLite file or reset only when you are comfortable deleting local data.

## Next Recommended Development Steps

1. Add an `/auth/me` endpoint so restored sessions can return full user details without display-cache fallback.
2. Add browser/E2E tests for login, clock-in/out, photo upload, pay generation, and report download.
3. Add report PDF visual regression checks.
4. Add cloud-ready file storage abstraction before deployment.
5. Add optional Singapore public holiday/rest day inputs without building a full MOM compliance engine.
