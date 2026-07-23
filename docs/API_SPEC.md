# API Spec: ClaimProof SG V1

All business endpoints require authentication unless noted. Every query must filter by the logged-in user's `userId`.

## Auth

- `POST /auth/register` with email, password, full name, and phone
- `POST /auth/resend-verification`
- `POST /auth/verify-email`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/logout`

Registration creates a pending account. A six-digit emailed code activates the account and starts its three-day trial. Resending invalidates older verification codes. Authentication and recovery endpoints are rate-limited in production.

## Profile

- `GET /profile`
- `PUT /profile`

## Companies

- `GET /companies`
- `POST /companies`
- `GET /companies/:id`
- `PUT /companies/:id`
- `DELETE /companies/:id`

## Projects

- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PUT /projects/:id`
- `DELETE /projects/:id`

## Time Entries

- `GET /time-entries`
- `POST /time-entries`
- `GET /time-entries/:id`
- `PUT /time-entries/:id`
- `DELETE /time-entries/:id`
- `POST /time-entries/clock-in`
- `POST /time-entries/:id/clock-out`
- `POST /time-entries/:id/finalize`

Time entry validation:

- Clock-out must be after clock-in.
- Break minutes are inclusive inside the clock-in to clock-out window.
- Break minutes cannot exceed on-site duration.
- Total hours are claimable work hours after subtracting inclusive break minutes.
- Overtime hours are calculated from total claimable work hours.

## Photo Evidence

- `GET /photo-evidence`
- `POST /photo-evidence/upload`
- `GET /photo-evidence/:id`
- `PUT /photo-evidence/:id`
- `DELETE /photo-evidence/:id`

Uploads use local storage in V1. Uploaded files must be linked to the logged-in user.

## Pay Summary

- `GET /pay-summaries`
- `POST /pay-summaries/generate`
- `GET /pay-summaries/:id`
- `DELETE /pay-summaries/:id`

Pay calculations must use shared backend calculation utilities.

## Reports

- `GET /reports`
- `POST /reports/progress-claim`
- `GET /reports/:id`
- `GET /reports/:id/pdf`
- `GET /reports/:id/csv`
- `DELETE /reports/:id`

Progress claim reports must snapshot worker, company, project, entries, and photos when generated.

## Settings

- `GET /settings`
- `PUT /settings`

Settings include standard daily hours, standard weekly hours, overtime multiplier, and default currency.
