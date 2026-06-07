# ClaimProof SG V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ClaimProof SG V1 as a mobile-first solo freelancer / worker evidence app for Singapore.

**Architecture:** Scaffold a React + TypeScript client and Node.js + Express + Prisma server in one repository. SQLite is the V1 database, local disk stores uploaded photos and generated exports, and every business record is owned by the logged-in user.

**Tech Stack:** React, TypeScript, Vite, Node.js, Express, Prisma, SQLite, bcrypt, JWT or secure HTTP-only auth cookie, multer, PDFKit or Puppeteer, CSV string generation, Vitest, React Testing Library.

---

## Scope Notes

This plan implements the approved solo-worker V1. Do not add employer approval, supervisor workflow, admin dashboard complexity, CPF automation, MOM submission, Stripe billing, GPS verification, facial recognition, AI OCR, or AI photo analysis.

Reference docs:

- `docs/superpowers/specs/2026-06-07-claimproof-sg-design.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/API_SPEC.md`
- `docs/BUILD_PLAN.md`
- `AGENTS.md`
- `SKILL.md`

## Target File Structure

```text
client/
  package.json
  index.html
  vite.config.ts
  tsconfig.json
  src/
    main.tsx
    App.tsx
    api/http.ts
    auth/AuthContext.tsx
    routes/ProtectedRoute.tsx
    layout/AppShell.tsx
    pages/LoginPage.tsx
    pages/RegisterPage.tsx
    pages/DashboardPage.tsx
    pages/ProfilePage.tsx
    pages/CompaniesPage.tsx
    pages/ProjectsPage.tsx
    pages/TimeEntriesPage.tsx
    pages/PhotoEvidencePage.tsx
    pages/PaySummaryPage.tsx
    pages/ReportsPage.tsx
    pages/SettingsPage.tsx
    pages/AdminPlaceholderPage.tsx
    components/ClockPanel.tsx
    components/MapPreview.tsx
    components/StatusBadge.tsx
    styles.css
server/
  package.json
  tsconfig.json
  vitest.config.ts
  prisma/schema.prisma
  prisma/seed.ts
  src/
    app.ts
    server.ts
    config/env.ts
    db/prisma.ts
    middleware/auth.ts
    middleware/requireUser.ts
    modules/auth/auth.routes.ts
    modules/auth/auth.service.ts
    modules/profile/profile.routes.ts
    modules/companies/company.routes.ts
    modules/projects/project.routes.ts
    modules/time/time.routes.ts
    modules/time/time.service.ts
    modules/photos/photo.routes.ts
    modules/pay/pay.routes.ts
    modules/pay/pay.service.ts
    modules/reports/report.routes.ts
    modules/reports/report.service.ts
    modules/settings/settings.routes.ts
    modules/admin/admin.routes.ts
    utils/timeCalculations.ts
    utils/payCalculations.ts
    utils/reportSnapshots.ts
    uploads/.gitkeep
    exports/.gitkeep
  tests/
    timeCalculations.test.ts
    payCalculations.test.ts
    reportSnapshots.test.ts
    ownership.test.ts
package.json
README.md
```

---

### Task 1: Repository And Tooling Scaffold

**Files:**
- Create: `package.json`
- Create: `client/package.json`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `client/vite.config.ts`
- Create: `client/tsconfig.json`
- Create: `client/index.html`
- Create: `README.md`

- [ ] **Step 1: Create root package scripts**

```json
{
  "name": "claimproof-sg",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace server\" \"npm run dev --workspace client\"",
    "build": "npm run build --workspace server && npm run build --workspace client",
    "test": "npm run test --workspace server && npm run test --workspace client",
    "db:migrate": "npm run db:migrate --workspace server",
    "db:seed": "npm run db:seed --workspace server"
  },
  "workspaces": ["client", "server"],
  "devDependencies": {
    "concurrently": "latest"
  }
}
```

- [ ] **Step 2: Create server package**

```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "prisma:generate": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "latest",
    "bcryptjs": "latest",
    "cookie-parser": "latest",
    "cors": "latest",
    "express": "latest",
    "jsonwebtoken": "latest",
    "multer": "latest",
    "pdfkit": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@types/cookie-parser": "latest",
    "@types/cors": "latest",
    "@types/express": "latest",
    "@types/jsonwebtoken": "latest",
    "@types/multer": "latest",
    "@types/node": "latest",
    "@types/pdfkit": "latest",
    "prisma": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 3: Create client package**

```json
{
  "name": "client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "leaflet": "latest",
    "react": "latest",
    "react-dom": "latest",
    "react-router-dom": "latest"
  },
  "devDependencies": {
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/leaflet": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: lockfile created and all packages installed.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json client server README.md
git commit -m "chore: scaffold ClaimProof SG workspace"
```

---

### Task 2: Prisma Schema And Seed Data

**Files:**
- Create: `server/prisma/schema.prisma`
- Create: `server/prisma/seed.ts`
- Create: `server/src/db/prisma.ts`

- [ ] **Step 1: Write Prisma schema**

Use the models from `docs/DATABASE_SCHEMA.md`. Enums must include `UserRole`, `UserStatus`, `EmploymentType`, `ProjectStatus`, `TimeEntryStatus`, `EvidenceType`, and `RateType`. Use `Decimal` for money and `Float` for hours/GPS.

- [ ] **Step 2: Add Prisma client singleton**

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 3: Add seed data**

Create demo user `demo@claimproof.sg` with password `Password123!`, worker profile, ABC Construction Pte Ltd, Steel Bracket Installation, five time entries, six placeholder evidence rows, one pay summary, and one progress claim report.

- [ ] **Step 4: Run migration and seed**

Run: `npm run db:migrate --workspace server`
Expected: SQLite database and migration are created.

Run: `npm run db:seed --workspace server`
Expected: demo records inserted without errors.

- [ ] **Step 5: Commit**

```bash
git add server/prisma server/src/db
git commit -m "feat: add ClaimProof database schema and seed data"
```

---

### Task 3: Calculation Utilities With Tests

**Files:**
- Create: `server/src/utils/timeCalculations.ts`
- Create: `server/src/utils/payCalculations.ts`
- Create: `server/tests/timeCalculations.test.ts`
- Create: `server/tests/payCalculations.test.ts`

- [ ] **Step 1: Write failing time tests**

```ts
import { describe, expect, it } from 'vitest';
import { calculateOvertimeHours, calculateTotalHours } from '../src/utils/timeCalculations';

describe('time calculations', () => {
  it('subtracts inclusive break minutes from clock duration', () => {
    const total = calculateTotalHours(new Date('2026-06-07T08:00:00+08:00'), new Date('2026-06-07T17:00:00+08:00'), 60);
    expect(total).toBe(8);
  });

  it('calculates overtime above standard daily hours', () => {
    expect(calculateOvertimeHours(9.5, 8)).toBe(1.5);
  });
});
```

- [ ] **Step 2: Implement time utilities**

```ts
export function calculateTotalHours(clockIn: Date, clockOut: Date, breakMinutes: number): number {
  if (clockOut <= clockIn) throw new Error('Clock-out must be after clock-in');
  if (breakMinutes < 0) throw new Error('Break minutes cannot be negative');
  const durationMinutes = (clockOut.getTime() - clockIn.getTime()) / 60000;
  if (breakMinutes > durationMinutes) throw new Error('Break minutes cannot exceed on-site duration');
  return roundHours((durationMinutes - breakMinutes) / 60);
}

export function calculateOvertimeHours(totalHours: number, standardDailyHours: number): number {
  if (totalHours < 0) throw new Error('Total hours cannot be negative');
  if (standardDailyHours <= 0) throw new Error('Standard daily hours must be positive');
  return roundHours(Math.max(0, totalHours - standardDailyHours));
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}
```

- [ ] **Step 3: Write pay tests**

```ts
import { describe, expect, it } from 'vitest';
import { calculateBasicPay, calculateGrossPay, calculateNetPay, calculateOvertimePay } from '../src/utils/payCalculations';

describe('pay calculations', () => {
  it('calculates basic and overtime pay', () => {
    expect(calculateBasicPay(8, 25)).toBe(200);
    expect(calculateOvertimePay(2, 37.5)).toBe(75);
  });

  it('calculates gross and net pay', () => {
    expect(calculateGrossPay(200, 75, 20, 0, 0)).toBe(295);
    expect(calculateNetPay(295, 15)).toBe(280);
  });
});
```

- [ ] **Step 4: Implement pay utilities**

```ts
export function calculateBasicPay(hours: number, hourlyRate: number): number {
  return roundMoney(hours * hourlyRate);
}

export function calculateOvertimePay(overtimeHours: number, overtimeRate: number): number {
  return roundMoney(overtimeHours * overtimeRate);
}

export function calculateGrossPay(basicPay: number, overtimePay: number, allowances: number, restDayPay: number, publicHolidayPay: number): number {
  return roundMoney(basicPay + overtimePay + allowances + restDayPay + publicHolidayPay);
}

export function calculateNetPay(grossPay: number, deductions: number): number {
  return roundMoney(grossPay - deductions);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm run test --workspace server -- timeCalculations payCalculations`
Expected: all calculation tests pass.

```bash
git add server/src/utils server/tests
git commit -m "feat: add time and pay calculation utilities"
```

---

### Task 4: Express App, Auth, And Ownership Middleware

**Files:**
- Create: `server/src/app.ts`
- Create: `server/src/server.ts`
- Create: `server/src/config/env.ts`
- Create: `server/src/middleware/auth.ts`
- Create: `server/src/middleware/requireUser.ts`
- Create: `server/src/modules/auth/auth.routes.ts`
- Create: `server/src/modules/auth/auth.service.ts`

- [ ] **Step 1: Implement Express app shell**

Create an app with JSON parsing, CORS, cookie parsing, `/auth` routes, and `/health`.

- [ ] **Step 2: Implement register/login/logout**

Use bcrypt password hashing and a signed auth token. Login returns the current user without `passwordHash`.

- [ ] **Step 3: Implement `requireUser`**

Middleware must reject missing/invalid auth and attach `{ id, email, role }` to the request.

- [ ] **Step 4: Add auth smoke tests**

Test register, login, logout, and protected route rejection.

- [ ] **Step 5: Run and commit**

Run: `npm run test --workspace server`
Expected: auth and calculation tests pass.

```bash
git add server/src server/tests
git commit -m "feat: add authentication and protected API shell"
```

---

### Task 5: Profile, Companies, And Projects APIs

**Files:**
- Create: `server/src/modules/profile/profile.routes.ts`
- Create: `server/src/modules/companies/company.routes.ts`
- Create: `server/src/modules/projects/project.routes.ts`
- Create: `server/tests/ownership.test.ts`

- [ ] **Step 1: Add profile routes**

Implement `GET /profile` and `PUT /profile` for the logged-in user only.

- [ ] **Step 2: Add company routes**

Implement CRUD routes from `docs/API_SPEC.md`. All queries use `where: { id, userId: req.user.id }` for single-record access.

- [ ] **Step 3: Add project routes**

Implement CRUD routes. Company linkage must verify the company belongs to the same user before saving `companyId`.

- [ ] **Step 4: Add ownership tests**

Create two users, create records for user A, verify user B cannot read/update/delete them.

- [ ] **Step 5: Run and commit**

Run: `npm run test --workspace server`
Expected: ownership tests pass.

```bash
git add server/src/modules server/tests/ownership.test.ts
git commit -m "feat: add profile company and project APIs"
```

---

### Task 6: Time Entry APIs With Clock In/Out

**Files:**
- Create: `server/src/modules/time/time.routes.ts`
- Create: `server/src/modules/time/time.service.ts`
- Modify: `server/src/app.ts`
- Add tests in: `server/tests/timeEntries.test.ts`

- [ ] **Step 1: Write time entry service tests**

Cover manual entry creation, clock-out-before-clock-in rejection, inclusive break rejection when break exceeds duration, overtime calculation, clock-in creation, clock-out update, and finalize.

- [ ] **Step 2: Implement service**

Service methods:

```ts
createManualEntry(userId, input)
clockIn(userId, input)
clockOut(userId, entryId, input)
finalize(userId, entryId)
listEntries(userId)
getEntry(userId, entryId)
updateEntry(userId, entryId, input)
deleteEntry(userId, entryId)
```

- [ ] **Step 3: Implement routes**

Expose all endpoints from `docs/API_SPEC.md` under `/time-entries`.

- [ ] **Step 4: Run and commit**

Run: `npm run test --workspace server -- timeEntries timeCalculations`
Expected: time tests pass.

```bash
git add server/src/modules/time server/tests/timeEntries.test.ts
git commit -m "feat: add time entry clock workflows"
```

---

### Task 7: Photo Evidence Upload APIs

**Files:**
- Create: `server/src/modules/photos/photo.routes.ts`
- Create: `server/src/uploads/.gitkeep`
- Add tests in: `server/tests/photoEvidence.test.ts`

- [ ] **Step 1: Implement multer local upload**

Store files under `server/uploads/<userId>/`. Persist relative `imagePath` in `PhotoEvidence`.

- [ ] **Step 2: Implement photo evidence CRUD**

Routes must verify project and optional time entry belong to the logged-in user.

- [ ] **Step 3: Add tests**

Test upload metadata ownership and rejection of another user's project/time entry IDs.

- [ ] **Step 4: Run and commit**

Run: `npm run test --workspace server -- photoEvidence ownership`
Expected: photo evidence tests pass.

```bash
git add server/src/modules/photos server/src/uploads server/tests/photoEvidence.test.ts
git commit -m "feat: add photo evidence uploads"
```

---

### Task 8: Pay Summary APIs

**Files:**
- Create: `server/src/modules/pay/pay.routes.ts`
- Create: `server/src/modules/pay/pay.service.ts`
- Add tests in: `server/tests/paySummary.test.ts`

- [ ] **Step 1: Write pay summary tests**

Test generated summary for a project period, allowance/deduction totals, gross pay, net pay, and itemised JSON fields.

- [ ] **Step 2: Implement pay service**

Use `calculateBasicPay`, `calculateOvertimePay`, `calculateGrossPay`, and `calculateNetPay`. Do not calculate pay inside route handlers.

- [ ] **Step 3: Implement routes**

Expose `GET /pay-summaries`, `POST /pay-summaries/generate`, `GET /pay-summaries/:id`, and `DELETE /pay-summaries/:id`.

- [ ] **Step 4: Run and commit**

Run: `npm run test --workspace server -- paySummary payCalculations`
Expected: pay tests pass.

```bash
git add server/src/modules/pay server/tests/paySummary.test.ts
git commit -m "feat: add pay summary generation"
```

---

### Task 9: Progress Claim Reports, PDF, And CSV

**Files:**
- Create: `server/src/modules/reports/report.routes.ts`
- Create: `server/src/modules/reports/report.service.ts`
- Create: `server/src/utils/reportSnapshots.ts`
- Create: `server/src/exports/.gitkeep`
- Add tests in: `server/tests/reportSnapshots.test.ts`

- [ ] **Step 1: Write snapshot tests**

Test that generated report snapshots contain worker, company, project, entries, photos, totals, and do not depend on later source object mutation.

- [ ] **Step 2: Implement snapshot utility**

Create a pure function `buildProgressClaimSnapshot(input)` returning company, worker, project, entries, photos, and totals snapshots.

- [ ] **Step 3: Implement report service**

Generate `ProgressClaimReport` rows with JSON snapshots and paths for PDF/CSV exports.

- [ ] **Step 4: Implement CSV export**

CSV includes dates, project, work descriptions, total hours, OT hours, rates, amounts, and evidence filenames.

- [ ] **Step 5: Implement PDF export**

PDF includes title, disclaimer, worker, client/company, project, claim period, totals, daily logs, photo evidence filenames/previews where feasible, rate calculation, and signature section.

- [ ] **Step 6: Run and commit**

Run: `npm run test --workspace server -- reportSnapshots`
Expected: snapshot tests pass.

```bash
git add server/src/modules/reports server/src/utils/reportSnapshots.ts server/src/exports server/tests/reportSnapshots.test.ts
git commit -m "feat: add progress claim report exports"
```

---

### Task 10: Settings And Admin Placeholder APIs

**Files:**
- Create: `server/src/modules/settings/settings.routes.ts`
- Create: `server/src/modules/admin/admin.routes.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Implement settings routes**

`GET /settings` creates defaults if missing. `PUT /settings` updates standard daily hours, weekly hours, OT multiplier, and currency.

- [ ] **Step 2: Implement admin placeholder route**

Return a static message that admin is reserved for future use.

- [ ] **Step 3: Run and commit**

Run: `npm run test --workspace server`
Expected: all server tests pass.

```bash
git add server/src/modules/settings server/src/modules/admin server/src/app.ts
git commit -m "feat: add settings and admin placeholder APIs"
```

---

### Task 11: React App Shell And Authentication UI

**Files:**
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/api/http.ts`
- Create: `client/src/auth/AuthContext.tsx`
- Create: `client/src/routes/ProtectedRoute.tsx`
- Create: `client/src/layout/AppShell.tsx`
- Create: `client/src/pages/LoginPage.tsx`
- Create: `client/src/pages/RegisterPage.tsx`
- Create: `client/src/styles.css`

- [ ] **Step 1: Implement API helper**

Create a fetch wrapper with JSON handling, credentials, and error messages.

- [ ] **Step 2: Implement auth context**

Track current user, login, register, logout, and loading state.

- [ ] **Step 3: Implement routes and layout**

Add mobile-first navigation for Dashboard, Time Entries, Projects, Photo Evidence, Pay Summary, Progress Claims, Clients / Companies, Settings.

- [ ] **Step 4: Implement login/register screens**

Include the required disclaimer in visible UI.

- [ ] **Step 5: Run and commit**

Run: `npm run build --workspace client`
Expected: client builds.

```bash
git add client/src client/index.html client/*.ts client/package.json
git commit -m "feat: add React auth shell"
```

---

### Task 12: Core CRUD Frontend Screens

**Files:**
- Create: `client/src/pages/ProfilePage.tsx`
- Create: `client/src/pages/CompaniesPage.tsx`
- Create: `client/src/pages/ProjectsPage.tsx`
- Create: `client/src/components/StatusBadge.tsx`

- [ ] **Step 1: Implement Profile page**

Load and save worker profile fields from `docs/PRODUCT_REQUIREMENTS.md`.

- [ ] **Step 2: Implement Companies page**

List, create, edit, and delete client/company records.

- [ ] **Step 3: Implement Projects page**

List, create, edit, and delete projects with company selection and status badges.

- [ ] **Step 4: Run and commit**

Run: `npm run build --workspace client`
Expected: client builds.

```bash
git add client/src/pages client/src/components
git commit -m "feat: add profile companies and projects UI"
```

---

### Task 13: Dashboard, Clock UI, GPS, And Map

**Files:**
- Create: `client/src/pages/DashboardPage.tsx`
- Create: `client/src/pages/TimeEntriesPage.tsx`
- Create: `client/src/components/ClockPanel.tsx`
- Create: `client/src/components/MapPreview.tsx`

- [ ] **Step 1: Implement live clock panel**

Show active project, clock status, live elapsed on-site duration, Clock In, Clock Out, Add Manual Entry, Upload Photo, and Generate Report buttons.

- [ ] **Step 2: Implement browser GPS capture**

Use `navigator.geolocation.getCurrentPosition` when the user taps Clock In or Clock Out. If permission is denied, submit the time action without GPS and show a non-blocking message.

- [ ] **Step 3: Implement map preview**

Use Leaflet to display clock-in and clock-out pins when coordinates exist.

- [ ] **Step 4: Implement Time Entries page**

List entries, show DRAFT/FINALIZED/manual badges, support manual entry form, finalize action, and detail view with on-site duration, inclusive break minutes, total hours, OT, and map.

- [ ] **Step 5: Run and commit**

Run: `npm run build --workspace client`
Expected: client builds.

```bash
git add client/src/pages/DashboardPage.tsx client/src/pages/TimeEntriesPage.tsx client/src/components/ClockPanel.tsx client/src/components/MapPreview.tsx
git commit -m "feat: add dashboard clock GPS and time entry UI"
```

---

### Task 14: Photo Evidence, Pay Summary, Reports, Settings UI

**Files:**
- Create: `client/src/pages/PhotoEvidencePage.tsx`
- Create: `client/src/pages/PaySummaryPage.tsx`
- Create: `client/src/pages/ReportsPage.tsx`
- Create: `client/src/pages/SettingsPage.tsx`
- Create: `client/src/pages/AdminPlaceholderPage.tsx`

- [ ] **Step 1: Implement Photo Evidence page**

Upload image, select project/time entry, choose evidence type, add caption, capture optional GPS, and list recent evidence.

- [ ] **Step 2: Implement Pay Summary page**

Generate summaries by period/project and display MOM-aware reference fields with disclaimer.

- [ ] **Step 3: Implement Reports page**

Generate progress claim report, list reports, and provide PDF/CSV download links.

- [ ] **Step 4: Implement Settings page**

Edit standard daily hours, weekly hours, overtime multiplier, and currency.

- [ ] **Step 5: Implement Admin Placeholder page**

Show a minimal reserved-for-future message.

- [ ] **Step 6: Run and commit**

Run: `npm run build --workspace client`
Expected: client builds.

```bash
git add client/src/pages
git commit -m "feat: add evidence pay reports and settings UI"
```

---

### Task 15: End-To-End Verification And Final Report

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run full verification**

Run: `npm run test`
Expected: server and client tests pass.

Run: `npm run build`
Expected: server and client build successfully.

Run: `npm run db:migrate`
Expected: Prisma migration applies.

Run: `npm run db:seed`
Expected: demo data is created.

Run: `npm run dev`
Expected: server and client start locally.

- [ ] **Step 2: Manual verification checklist**

Verify:

- Demo login works with `demo@claimproof.sg` / `Password123!`.
- Dashboard loads.
- Clock In creates an active entry.
- Clock Out calculates claimable hours with inclusive break handling.
- Manual entry is marked manual.
- GPS coordinates are saved when browser permission is granted.
- Map renders for entries with coordinates.
- Photo evidence upload creates a record.
- Pay summary generation works.
- Progress claim PDF downloads.
- Progress claim CSV downloads.
- User cannot access another user's records through API.

- [ ] **Step 3: Update README**

Include project structure, run instructions, migration command, seed command, demo login, completed features, placeholder features, known limitations, PDF/CSV status, and next recommended development steps.

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: add ClaimProof SG runbook"
```

---

## Self-Review

Spec coverage:

- Authentication: Task 4 and Task 11.
- Worker profile: Task 5 and Task 12.
- Clients/companies: Task 5 and Task 12.
- Projects: Task 5 and Task 12.
- Time entries, real-time clock, inclusive breaks, GPS, map: Task 6 and Task 13.
- Photo evidence: Task 7 and Task 14.
- Pay summary: Task 8 and Task 14.
- Progress claim PDF/CSV with snapshots: Task 9 and Task 14.
- Settings: Task 10 and Task 14.
- Admin placeholder only: Task 10 and Task 14.
- Seed data: Task 2.
- Tests: Tasks 3, 4, 5, 6, 7, 8, 9, and 15.
- Security ownership filtering: Tasks 4, 5, 7, and 15.

Placeholder scan: no unresolved placeholder markers are used as plan content. Future-only features are explicitly scoped as limited V1 stubs per the approved spec.

Type consistency: model and field names match `docs/DATABASE_SCHEMA.md`; endpoint names match `docs/API_SPEC.md`; calculation function names match `SKILL.md` and the design spec.
