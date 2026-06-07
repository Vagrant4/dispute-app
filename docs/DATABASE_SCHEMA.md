# Database Schema: ClaimProof SG V1

SQLite and Prisma will be used for V1.

## Ownership Rule

Every main business table must include `userId`. Every backend query must filter by the logged-in user's `userId`.

## Models

### User

- `id`
- `email`
- `passwordHash`
- `role`: `WORKER` / `ADMIN_PLACEHOLDER`
- `status`: `ACTIVE` / `SUSPENDED`
- `createdAt`
- `updatedAt`

### WorkerProfile

- `id`
- `userId`
- `fullName`
- `phone`
- `workerIdentifier`, optional
- `finNric`, optional
- `trade`
- `employmentType`: `HOURLY` / `DAILY` / `MONTHLY` / `FREELANCER`
- `defaultHourlyRate`
- `defaultDailyRate`
- `defaultMonthlySalary`
- `createdAt`
- `updatedAt`

### Company

Represents client/company/employer details for record purposes only.

- `id`
- `userId`
- `name`
- `uen`, optional
- `contactPerson`
- `email`
- `phone`
- `address`
- `notes`
- `createdAt`
- `updatedAt`

### Project

- `id`
- `userId`
- `companyId`, optional
- `projectName`
- `siteAddress`
- `poOrWorkOrderNumber`, optional
- `startDate`
- `endDate`, optional
- `description`
- `defaultHourlyRate`
- `defaultDailyRate`
- `status`: `ACTIVE` / `COMPLETED` / `ON_HOLD` / `CANCELLED`
- `createdAt`
- `updatedAt`

### TimeEntry

- `id`
- `userId`
- `projectId`
- `date`
- `clockInTime`
- `clockOutTime`
- `breakMinutes`
- `totalHours`
- `overtimeHours`
- `workDescription`
- `manualEntryFlag`
- `locationText`
- `clockInGpsLat`, optional
- `clockInGpsLng`, optional
- `clockOutGpsLat`, optional
- `clockOutGpsLng`, optional
- `status`: `DRAFT` / `FINALIZED`
- `notes`
- `createdAt`
- `updatedAt`

Validation:

- `clockOutTime` must be after `clockInTime`.
- `breakMinutes` cannot exceed on-site duration.
- `totalHours = clockOutTime - clockInTime - breakMinutes`.
- `overtimeHours = totalHours above standardDailyHours`.
- Manual entries must be clearly marked.

### PhotoEvidence

- `id`
- `userId`
- `projectId`
- `timeEntryId`, optional
- `imagePath`
- `caption`
- `evidenceType`: `BEFORE_WORK` / `DURING_WORK` / `AFTER_WORK` / `DEFECT` / `COMPLETED_WORK` / `MATERIAL_DELIVERY` / `VARIATION_WORK` / `OTHER`
- `timestamp`
- `gpsLat`, optional
- `gpsLng`, optional
- `createdAt`
- `updatedAt`

### PaySummary

- `id`
- `userId`
- `projectId`, optional
- `salaryPeriodStart`
- `salaryPeriodEnd`
- `rateType`: `HOURLY` / `DAILY` / `MONTHLY` / `FREELANCER`
- `basicRate`
- `basicPay`
- `overtimeRate`
- `overtimePay`
- `restDayPay`
- `publicHolidayPay`
- `totalAllowances`
- `totalDeductions`
- `grossPay`
- `netPay`
- `itemisedPayslipJson`
- `notes`
- `createdAt`
- `updatedAt`

Itemised payslip JSON fields:

- `workerName`
- `clientCompanyName`
- `paymentDate`
- `salaryPeriodStart`
- `salaryPeriodEnd`
- `basicPay`
- `allowances`
- `deductions`
- `overtimeHours`
- `overtimePay`
- `grossPay`
- `netPay`
- `notes`

### Allowance

- `id`
- `paySummaryId`
- `description`
- `amount`

### Deduction

- `id`
- `paySummaryId`
- `description`
- `amount`

### ProgressClaimReport

- `id`
- `userId`
- `projectId`
- `companySnapshotJson`
- `workerSnapshotJson`
- `projectSnapshotJson`
- `claimPeriodStart`
- `claimPeriodEnd`
- `totalDaysWorked`
- `totalHours`
- `totalOvertimeHours`
- `totalClaimAmount`
- `entriesSnapshotJson`
- `photosSnapshotJson`
- `pdfPath`
- `csvPath`
- `notes`
- `createdAt`
- `updatedAt`

Snapshot JSON keeps exported reports stable after source records are edited.

### AppSetting

- `id`
- `userId`
- `standardDailyHours`
- `standardWeeklyHours`
- `overtimeMultiplier`
- `defaultCurrency`
- `createdAt`
- `updatedAt`

Defaults:

- `standardDailyHours = 8`
- `standardWeeklyHours = 44`
- `overtimeMultiplier = 1.5`
- `defaultCurrency = SGD`

### SubscriptionPlan

Placeholder only.

- `id`
- `name`
- `price`
- `limitsJson`
- `status`
