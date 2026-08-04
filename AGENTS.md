# AGENTS.md

## Project Mission

Build ClaimProof SG as a mobile-first freelancer evidence app.

The app helps a worker/freelancer record:
- Time worked
- Project activity
- Photo evidence
- Pay summary
- Progress claim reports
- Dispute evidence

This is not HR software, not ERP software, and not a full legal payroll system.

## Build Priority

Build in this order:
1. Authentication
2. Profile
3. Clients
4. Projects
5. Time entries
6. Photo evidence
7. Pay summary
8. PDF/CSV progress claim report
9. Settings

## Development Rules

Use:
- TypeScript strict mode
- Prisma
- Reusable services
- Reusable calculation utilities
- Mobile-first UI

Avoid:
- Overengineering
- Employer approval workflow
- Admin dashboard complexity
- Multi-company HR logic
- Duplicate calculation logic
- Massive components

## Data Ownership

Every main table must include userId.

Every backend query must filter by userId.

Never expose another user's data.

Exception: `AccountDeletionReceipt` is deliberately anonymous and must not contain
`userId` or other identifying data. Queries for this table must use only its random,
unguessable request ID. This exception preserves proof of deletion without retaining
an identity link after the account is permanently removed.

Exception: `Referral` is a relationship between two users and therefore uses
`referrerUserId` and `referredUserId` instead of an ambiguous `userId`. Every
user-facing referral query must scope by the relevant relationship field. Internal
transactional updates must retain the referrer or referred-user constraint that
selected the record; an unscoped referral ID mutation is not allowed.

## Evidence First Rule

When unsure, choose the option that improves:
- Evidence quality
- Report quality
- Dispute support
- Progress claim documentation

## Do Not Build Yet

Only placeholders for:
- CPF
- MOM automation
- Stripe billing
- GPS verification
- Work Permit tracking
- AI OCR
- AI photo analysis
