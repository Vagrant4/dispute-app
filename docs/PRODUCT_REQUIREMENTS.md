# Product Requirements: ClaimProof SG V1

## Mission

ClaimProof SG is a mobile-first evidence app for a solo freelancer or worker in Singapore. It helps the worker record time worked, project activity, photo evidence, pay summaries, progress claim reports, and dispute evidence.

This is not HR software, ERP software, a MOM submission tool, or a full legal payroll engine.

## Disclaimer

The UI must display:

> "This app helps you record work, time, pay, and evidence for reference. It does not replace legal, accounting, or MOM advice."

## V1 User Role

V1 has one active user role:

- `WORKER`

Admin may exist only as:

- `ADMIN_PLACEHOLDER`

Do not build admin approval, employer approval, supervisor workflow, or multi-company HR management.

## Feature Order

Build in this order:

1. Authentication
2. Worker profile
3. Clients / companies
4. Projects
5. Time entries
6. Photo evidence
7. Pay summary
8. Progress claim PDF/CSV export
9. Settings
10. Admin placeholder

## Core Features

### Authentication

- Register with email/password.
- Login with email/password.
- Logout.
- Protect all app screens except login/register.

### Worker Profile

Fields:

- Full name
- Phone
- Worker identifier, optional
- FIN/NRIC, optional
- Trade
- Employment type: `HOURLY`, `DAILY`, `MONTHLY`, `FREELANCER`
- Default hourly rate
- Default daily rate
- Default monthly salary

### Clients / Companies

Company records represent client/company/employer details for record purposes only.

Fields:

- Name
- UEN, optional
- Contact person
- Email
- Phone
- Address
- Notes

### Projects

Fields:

- Project name
- Client/company, optional
- Site address
- PO or work order number, optional
- Start date
- End date, optional
- Description
- Default hourly rate
- Default daily rate
- Status: `ACTIVE`, `COMPLETED`, `ON_HOLD`, `CANCELLED`

### Time Entries

Time tracking supports real-time clock in/out and manual past entries.

Rules:

- Clock-out must be after clock-in.
- Break minutes are inclusive within the clock-in to clock-out window.
- Break minutes cannot exceed on-site duration.
- On-site duration equals clock-out minus clock-in.
- Claimable work hours equals on-site duration minus break minutes.
- Overtime hours equal claimable work hours above standard daily hours.
- Manual entries must be clearly marked.

GPS:

- Capture optional GPS at clock in and clock out when the browser allows it.
- Display clock-in and clock-out locations on a map when coordinates exist.
- V1 does not verify GPS authenticity.

### Photo Evidence

Fields:

- Linked project
- Optional linked time entry
- Uploaded image path
- Caption
- Evidence type: `BEFORE_WORK`, `DURING_WORK`, `AFTER_WORK`, `DEFECT`, `COMPLETED_WORK`, `MATERIAL_DELIVERY`, `VARIATION_WORK`, `OTHER`
- Timestamp
- Optional GPS

### Pay Summary

Fields:

- Salary period start/end
- Rate type
- Basic rate
- Basic pay
- Overtime rate/pay
- Rest day pay
- Public holiday pay
- Allowances
- Deductions
- Gross pay
- Net pay
- MOM-aware itemised payslip JSON
- Notes

MOM-aware fields are reference fields only.

### Progress Claim Reports

Reports must use snapshot JSON so exports remain unchanged after source records are edited.

PDF and CSV reports include:

- Report title
- Disclaimer
- Worker profile
- Client/company details
- Project details
- Claim period
- Total days worked
- Total on-site duration
- Total claimable work hours
- Total overtime hours
- Daily work log
- Photo evidence previews or filenames
- Rate calculation
- Basic pay
- OT pay
- Allowances
- Deductions
- Gross pay
- Net pay
- Signature section

## V1 Placeholders Only

Do not build these beyond placeholders:

- CPF
- MOM automation
- Stripe billing
- GPS verification
- Work Permit tracking
- AI OCR
- AI photo analysis
