# ClaimProof SG V1 Design

## Product Scope

ClaimProof SG V1 is a mobile-first solo freelancer / worker evidence app for Singapore. The app helps a self-owned worker record work time, project activity, photo evidence, pay summaries, and progress claim reports for reference during salary claims, progress claims, client disputes, or employer verification.

The app is Singapore MOM-aware, but it is not a legal payroll or statutory compliance system. The UI must show this disclaimer:

> "This app helps you record work, time, pay, and evidence for reference. It does not replace legal, accounting, or MOM advice."

V1 includes authentication, worker profile, clients/companies, projects, real-time clock in/out, optional GPS capture, map display, manual time entries, photo evidence, pay summaries, PDF/CSV progress claim exports, settings, and a minimal admin placeholder route.

V1 excludes employer approval, supervisor workflows, admin dashboard complexity, CPF automation, MOM submission, full legal payroll rules, Stripe billing, multi-company HR management, GPS anti-spoofing, facial recognition, AI OCR, and AI photo analysis.

## Architecture

The app will be scaffolded from scratch because the workspace has no existing app.

- `client/`: React + TypeScript mobile-first frontend.
- `server/`: Node.js + Express API.
- `server/prisma/`: Prisma schema, migrations, and seed data.
- `server/uploads/`: local V1 photo storage.
- `server/exports/`: generated PDF and CSV reports.
- `docs/`: product requirements, database schema, API spec, and build plan.
- `AGENTS.md`: repository instructions.
- `SKILL.md`: project workflow rules.

SQLite is the V1 database. Prisma owns the schema and migrations. The backend enforces authentication, user-owned query filtering, validation, reusable calculation utilities, file upload handling, report snapshot generation, PDF export, and CSV export.

The frontend provides mobile-first screens, live active clock display, browser geolocation capture when available, map display for recorded GPS points, clear status badges, evidence upload forms, and report download flows.

## Data Model

The main Prisma models are:

- `User`: login identity with email, password hash, role, and status.
- `WorkerProfile`: worker details, trade, employment type, and default rates.
- `Company`: client/company/employer reference records owned by the worker.
- `Project`: project, site, PO/work order, dates, rates, description, and status.
- `TimeEntry`: clock times, inclusive break minutes, calculated hours, work description, manual-entry flag, location, GPS, status, and notes.
- `PhotoEvidence`: uploaded image path, evidence type, caption, timestamp, optional GPS, linked project, and optional linked time entry.
- `PaySummary`: period, rate type, basic pay, OT pay, allowances, deductions, rest day/public holiday pay, gross pay, net pay, and MOM-aware itemised JSON.
- `Allowance` and `Deduction`: line items attached to a pay summary.
- `ProgressClaimReport`: immutable snapshot JSON plus totals and export paths.
- `AppSetting`: standard daily hours, standard weekly hours, OT multiplier, and currency.
- `SubscriptionPlan`: placeholder only.

Every main business record belongs to the logged-in user. Backend queries must filter by `userId`; no user can access another user's records.

Progress claim reports store snapshot JSON for worker, company, project, entries, and photos so generated reports do not change when source records are edited later.

## Time Tracking And GPS

The worker selects an active project and taps Clock In. The app records the clock-in timestamp and optional browser GPS coordinates. The dashboard shows active project, live elapsed on-site duration, and current clock status.

The worker can add break minutes and work notes during or after a session. Break time is inclusive inside the clock-in to clock-out window:

```text
onSiteDuration = clockOutTime - clockInTime
claimableWorkHours = onSiteDuration - breakMinutes
overtimeHours = max(0, claimableWorkHours - standardDailyHours)
```

When the worker taps Clock Out, the app records the clock-out timestamp and optional GPS coordinates, then calculates on-site duration, claimable work hours, and overtime hours.

The time entry detail screen shows clock-in/out times, on-site duration, inclusive break minutes, claimable work hours, overtime hours, work description, manual-entry badge, and a map with clock-in/out pins when GPS exists.

Manual entries are allowed for past work but must be clearly marked. They use the same calculation rules.

GPS in V1 is evidence context only. The app stores and displays GPS, but does not verify authenticity, detect spoofing, enforce geofencing, or prove physical presence.

## Reports And Exports

Progress claim reports are generated from selected project records and a claim period. A generated report contains immutable snapshots of relevant worker, client/company, project, time entry, photo, and calculated data.

PDF and CSV exports include report title, disclaimer, worker profile, client/company details, project details, claim period, total days worked, total on-site duration, total claimable work hours, total overtime hours, daily work log, photo evidence grouped by date and evidence type, rate calculation, basic pay, OT pay, allowances, deductions, gross pay, net pay, and a signature section for Prepared by, Submitted to, and Date.

PDF output should be printable and professional. CSV output should prioritize structured evidence data: dates, project, work descriptions, hours, OT, rates, amounts, and linked evidence filenames.

Pay summaries are separate records but can be used to support report calculations. MOM-aware itemised payslip fields are reference fields only and must be shown with notes that the app is not a statutory payroll engine.

## API Surface

The backend exposes REST endpoints for authentication, profile, companies, projects, time entries, photo evidence, pay summaries, reports, and settings.

Important time endpoints include `POST /time-entries/clock-in`, `POST /time-entries/:id/clock-out`, and `POST /time-entries/:id/finalize`.

Important export endpoints include `GET /reports/:id/pdf` and `GET /reports/:id/csv`.

## Calculation Utilities

Time and pay logic must live in reusable utilities, not UI components.

Required time utilities:

- `calculateTotalHours(clockIn, clockOut, breakMinutes)`
- `calculateOvertimeHours(totalHours, standardDailyHours)`

Required pay utilities:

- `calculateBasicPay(hours, hourlyRate)`
- `calculateOvertimePay(overtimeHours, overtimeRate)`
- `calculateGrossPay(basicPay, overtimePay, allowances, restDayPay, publicHolidayPay)`
- `calculateNetPay(grossPay, deductions)`

Defaults:

- Standard daily hours: `8`
- Standard weekly hours: `44`
- Overtime multiplier: `1.5`
- Currency: `SGD`

## Screens

V1 screens:

- Login
- Register
- Dashboard
- Profile
- Clients / Companies
- Projects
- Time Entries
- Photo Evidence
- Pay Summary
- Progress Claim Reports
- Settings
- Admin Placeholder

The dashboard shows today's clock status, active project, total hours today, total hours this week, draft records, recent photo evidence, and quick action buttons for Clock In, Clock Out, Add Manual Entry, Upload Photo, and Generate Report.

## Testing

Tests should cover total hour calculation, inclusive break handling, overtime calculation, basic pay calculation, gross/net pay calculation, report snapshot generation, and user ownership filtering.

## Delivery

Implementation should finish with a concise report covering project structure, local run instructions, migration command, seed command, demo login, completed features, placeholder features, known limitations, PDF/CSV export status, and recommended next steps.
