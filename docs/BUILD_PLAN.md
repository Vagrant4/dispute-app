# Build Plan: ClaimProof SG V1

## Phase 1: Project Setup

- Scaffold `client/` with React, TypeScript, and mobile-first routing.
- Scaffold `server/` with Express, TypeScript, Prisma, SQLite, and test runner.
- Add root scripts for development, build, test, Prisma migration, and seed.
- Create upload and export directories.

## Phase 2: Documentation And Repository Instructions

- Maintain `docs/PRODUCT_REQUIREMENTS.md`.
- Maintain `docs/DATABASE_SCHEMA.md`.
- Maintain `docs/API_SPEC.md`.
- Maintain `docs/BUILD_PLAN.md`.
- Use `AGENTS.md` and `SKILL.md` as repository guidance.

## Phase 3: Authentication

- Implement register, login, logout.
- Hash passwords.
- Protect API routes.
- Protect frontend app routes.

## Phase 4: Profile, Companies, Projects

- Implement worker profile CRUD.
- Implement company CRUD.
- Implement project CRUD.
- Enforce user ownership on every query.

## Phase 5: Time Entries

- Implement manual time entry creation.
- Implement real-time clock-in endpoint.
- Implement clock-out endpoint.
- Capture optional browser GPS from frontend.
- Show active elapsed time on dashboard.
- Calculate on-site duration, claimable work hours, and overtime hours.
- Mark manual entries clearly.
- Add map display for clock-in/out coordinates.

## Phase 6: Photo Evidence

- Implement local file upload.
- Link evidence to project and optional time entry.
- Store evidence type, caption, timestamp, and optional GPS.
- Show recent evidence on dashboard.

## Phase 7: Pay Summary

- Implement reusable pay utilities.
- Generate pay summaries for a period/project.
- Store MOM-aware itemised JSON.
- Show disclaimer and MOM-aware notes in UI.

## Phase 8: Progress Claim Reports

- Generate report snapshot JSON.
- Generate printable PDF export.
- Generate CSV export.
- Provide report download endpoints.
- Include signature section and disclaimer.

## Phase 9: Settings And Placeholder Features

- Implement settings for daily hours, weekly hours, OT multiplier, and currency.
- Add admin placeholder route.
- Add placeholders only for CPF, MOM automation, Stripe billing, GPS verification, Work Permit tracking, AI OCR, and AI photo analysis.

## Phase 10: Seed Data

Seed:

- Demo user: `demo@claimproof.sg` / `Password123!`
- Worker: Demo Freelancer
- Trade: Steel / Site Works
- Employment type: Freelancer
- Hourly rate: SGD 25
- Client: ABC Construction Pte Ltd
- Project: Steel Bracket Installation
- Site: Jurong, Singapore
- Five time entries
- Six placeholder photo evidence records
- One pay summary
- One progress claim report

## Phase 11: Tests

Add tests for:

- Total hour calculation
- Inclusive break handling
- Overtime calculation
- Basic pay calculation
- Gross/net pay calculation
- Report snapshot generation
- User ownership filtering

## Phase 12: Final Verification

- Run tests.
- Run build.
- Run migration and seed.
- Start local app.
- Verify login and core flows.
- Confirm PDF and CSV exports work or document any limitation.
