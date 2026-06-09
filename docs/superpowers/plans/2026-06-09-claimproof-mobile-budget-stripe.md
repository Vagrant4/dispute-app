# ClaimProof SG Mobile Budget Stripe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a low-cost Expo mobile foundation for ClaimProof SG with offline local storage, backup/restore, evidence locking, secure sensitive identifiers, app-store privacy docs, and a policy-safe Stripe subscription foundation.

**Architecture:** Keep the existing `client/` web app and `server/` API working. Add `mobile/` for the Expo React Native app and `shared/` for reusable TypeScript logic used by web, server, and mobile. Mobile stores evidence locally by default; the server is only extended for Stripe/web subscription entitlement.

**Tech Stack:** Expo React Native, TypeScript, Expo SQLite, Expo FileSystem, Expo SecureStore, Expo Sharing, Expo Location, Expo ImagePicker, Node/Express, Prisma, Stripe, Vitest.

---

## Scope Notes

This plan implements the first mobile architecture slice, not a full rebuild of every web screen.

Included:

- `/mobile` Expo app foundation.
- `/shared` calculation, type, snapshot, CSV, and evidence-lock utilities.
- Mobile SQLite schema/service layer.
- SecureStore service for FIN/NRIC/worker ID.
- JSON backup export and import.
- Generated document archive model.
- Evidence lock hashing for local records.
- Local file/share service foundation.
- Privacy/backup/subscription/status screens.
- Stripe backend foundation using environment-configured price IDs.
- App Store / Google Play readiness docs.

Not included:

- Cloud sync.
- User-to-user sharing.
- Employer approval.
- In-app Stripe payment collection inside iOS/Android app.
- CPF automation.
- MOM submission.
- AI OCR or AI photo analysis.
- Paid analytics.

## Target File Structure

```text
package.json
shared/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    timeCalculations.ts
    payCalculations.ts
    reportSnapshots.ts
    csvExport.ts
    evidenceLock.ts
  tests/
    timeCalculations.test.ts
    payCalculations.test.ts
    evidenceLock.test.ts
    csvExport.test.ts
mobile/
  package.json
  app.json
  tsconfig.json
  App.tsx
  src/
    db/schema.ts
    db/localDatabase.ts
    db/repositories.ts
    storage/secureIdentifiers.ts
    storage/localFiles.ts
    backup/backupService.ts
    reports/localExports.ts
    subscription/subscriptionStatus.ts
    screens/HomeScreen.tsx
    screens/PrivacyScreen.tsx
    screens/SettingsBackupScreen.tsx
    screens/SubscriptionScreen.tsx
    screens/StorageDiagnosticsScreen.tsx
    screens/EvidenceLockScreen.tsx
    styles.ts
  tests/
    backupService.test.ts
    evidenceLockScreen.test.tsx
server/
  prisma/schema.prisma
  src/modules/subscriptions/subscription.routes.ts
  src/modules/subscriptions/subscription.service.ts
  src/app.ts
  src/config/env.ts
  tests/subscriptions.test.ts
docs/
  MOBILE_APP_STORE_PLAN.md
  PRIVACY_DISCLOSURE_DRAFT.md
  DATA_SAFETY_NOTES.md
  LOCAL_STORAGE_BACKUP_POLICY.md
```

---

### Task 1: Workspace And Shared Package Scaffold

**Files:**
- Modify: `package.json`
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/index.ts`
- Create: `shared/src/types.ts`
- Create: `shared/src/timeCalculations.ts`
- Create: `shared/src/payCalculations.ts`
- Create: `shared/tests/timeCalculations.test.ts`
- Create: `shared/tests/payCalculations.test.ts`

- [ ] **Step 1: Add workspace entries**

Modify root `package.json` so workspaces include `shared` and `mobile`:

```json
{
  "workspaces": ["client", "server", "shared", "mobile"]
}
```

Keep existing scripts intact.

- [ ] **Step 2: Create shared package**

Create `shared/package.json`:

```json
{
  "name": "@claimproof/shared",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

Create `shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Add shared types**

Create `shared/src/types.ts`:

```ts
export type EmploymentType = 'HOURLY' | 'DAILY' | 'MONTHLY' | 'FREELANCER';
export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
export type EvidenceType =
  | 'BEFORE_WORK'
  | 'DURING_WORK'
  | 'AFTER_WORK'
  | 'DEFECT'
  | 'COMPLETED_WORK'
  | 'MATERIAL_DELIVERY'
  | 'VARIATION_WORK'
  | 'OTHER';
export type RecordStatus = 'DRAFT' | 'FINALIZED' | 'LOCKED';
export type GeneratedDocumentType =
  | 'PROGRESS_CLAIM_PDF'
  | 'TIME_ENTRIES_CSV'
  | 'PAY_SUMMARY_CSV'
  | 'PROGRESS_CLAIM_CSV'
  | 'JSON_BACKUP';

export interface LocalWorkerProfile {
  id: string;
  fullName: string;
  phone: string;
  trade: string;
  employmentType: EmploymentType;
  secureIdentifierKey?: string | null;
  defaultHourlyRate?: number | null;
  defaultDailyRate?: number | null;
  defaultMonthlySalary?: number | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: Move calculation utilities into shared**

Copy the validated implementations from `server/src/utils/timeCalculations.ts` and `server/src/utils/payCalculations.ts` into:

- `shared/src/timeCalculations.ts`
- `shared/src/payCalculations.ts`

Do not remove the server files in this task. Keeping duplicates temporarily avoids destabilizing the existing server.

- [ ] **Step 5: Add shared exports**

Create `shared/src/index.ts`:

```ts
export * from './types';
export * from './timeCalculations';
export * from './payCalculations';
```

- [ ] **Step 6: Add shared calculation tests**

Create `shared/tests/timeCalculations.test.ts` and `shared/tests/payCalculations.test.ts` with the same behavioral cases as the server calculation tests.

- [ ] **Step 7: Run verification**

Run:

```powershell
npm.cmd install
npm.cmd run test --workspace shared
npm.cmd run build --workspace shared
npm.cmd run test
npm.cmd run build
```

Expected:

- Shared tests pass.
- Existing server/client tests pass.
- Existing server/client builds pass.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json shared
git commit -m "feat: add shared ClaimProof logic package"
```

---

### Task 2: Expo Mobile App Scaffold

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/App.tsx`
- Create: `mobile/src/styles.ts`
- Create: `mobile/src/screens/HomeScreen.tsx`
- Create: `mobile/src/screens/PrivacyScreen.tsx`
- Create: `mobile/src/screens/SettingsBackupScreen.tsx`
- Create: `mobile/src/screens/SubscriptionScreen.tsx`
- Create: `mobile/src/screens/StorageDiagnosticsScreen.tsx`
- Create: `mobile/src/screens/EvidenceLockScreen.tsx`

- [ ] **Step 1: Create mobile package**

Create `mobile/package.json`:

```json
{
  "name": "mobile",
  "private": true,
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "@claimproof/shared": "*",
    "expo": "latest",
    "expo-crypto": "latest",
    "expo-file-system": "latest",
    "expo-image-picker": "latest",
    "expo-location": "latest",
    "expo-secure-store": "latest",
    "expo-sharing": "latest",
    "expo-sqlite": "latest",
    "react": "latest",
    "react-native": "latest"
  },
  "devDependencies": {
    "@types/react": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Add Expo app metadata**

Create `mobile/app.json`:

```json
{
  "expo": {
    "name": "ClaimProof SG",
    "slug": "claimproof-sg",
    "scheme": "claimproofsg",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "ios": {
      "bundleIdentifier": "sg.claimproof.app",
      "supportsTablet": true,
      "infoPlist": {
        "NSCameraUsageDescription": "ClaimProof SG uses the camera so you can capture work evidence photos.",
        "NSPhotoLibraryUsageDescription": "ClaimProof SG lets you select existing photos as work evidence.",
        "NSLocationWhenInUseUsageDescription": "ClaimProof SG can attach optional GPS coordinates to clock and photo evidence."
      }
    },
    "android": {
      "package": "sg.claimproof.app",
      "permissions": ["CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "READ_MEDIA_IMAGES"]
    }
  }
}
```

- [ ] **Step 3: Add TypeScript config**

Create `mobile/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "Bundler",
    "baseUrl": "."
  },
  "include": ["App.tsx", "src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 4: Add mobile shell**

Create `mobile/App.tsx` with simple tab-like state navigation:

```tsx
import { useState } from 'react';
import { SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { PrivacyScreen } from './src/screens/PrivacyScreen';
import { SettingsBackupScreen } from './src/screens/SettingsBackupScreen';
import { SubscriptionScreen } from './src/screens/SubscriptionScreen';
import { StorageDiagnosticsScreen } from './src/screens/StorageDiagnosticsScreen';
import { EvidenceLockScreen } from './src/screens/EvidenceLockScreen';
import { styles } from './src/styles';

type Tab = 'home' | 'privacy' | 'backup' | 'subscription' | 'storage' | 'lock';

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'backup', label: 'Backup' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'subscription', label: 'Plan' },
  { key: 'storage', label: 'Storage' },
  { key: 'lock', label: 'Lock' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>ClaimProof SG</Text>
        <Text style={styles.subtitle}>Offline-first worker evidence</Text>
      </View>
      <View style={styles.nav}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.navButton, activeTab === tab.key && styles.navButtonActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.navText, activeTab === tab.key && styles.navTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'home' && <HomeScreen />}
        {activeTab === 'privacy' && <PrivacyScreen />}
        {activeTab === 'backup' && <SettingsBackupScreen />}
        {activeTab === 'subscription' && <SubscriptionScreen />}
        {activeTab === 'storage' && <StorageDiagnosticsScreen />}
        {activeTab === 'lock' && <EvidenceLockScreen />}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: Add foundation screens**

Create screens that display the local-first privacy warning, backup/import controls, subscription status, storage diagnostics, and evidence lock explanation. Use large mobile-friendly buttons and no cloud-sync language.

- [ ] **Step 6: Run verification**

Run:

```powershell
npm.cmd install
npm.cmd run typecheck --workspace mobile
npm.cmd run test --workspace mobile
npm.cmd run test
npm.cmd run build
```

Expected:

- Mobile typecheck passes.
- Mobile tests command exits successfully.
- Existing web/server tests and builds pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json mobile
git commit -m "feat: scaffold Expo mobile app"
```

---

### Task 3: Mobile SQLite Schema And Local Database Service

**Files:**
- Create: `mobile/src/db/schema.ts`
- Create: `mobile/src/db/localDatabase.ts`
- Create: `mobile/src/db/repositories.ts`
- Create: `mobile/tests/localDatabase.test.ts`

- [ ] **Step 1: Define local schema SQL**

Create `mobile/src/db/schema.ts`:

```ts
export const mobileSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    standardDailyHours REAL NOT NULL,
    standardWeeklyHours REAL NOT NULL,
    overtimeMultiplier REAL NOT NULL,
    defaultCurrency TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS worker_profiles (
    id TEXT PRIMARY KEY,
    fullName TEXT NOT NULL,
    phone TEXT NOT NULL,
    trade TEXT NOT NULL,
    employmentType TEXT NOT NULL,
    secureIdentifierKey TEXT,
    defaultHourlyRate REAL,
    defaultDailyRate REAL,
    defaultMonthlySalary REAL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    uen TEXT,
    contactPerson TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    companyId TEXT,
    projectName TEXT NOT NULL,
    siteAddress TEXT NOT NULL,
    poOrWorkOrderNumber TEXT,
    startDate TEXT NOT NULL,
    endDate TEXT,
    description TEXT,
    defaultHourlyRate REAL,
    defaultDailyRate REAL,
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS time_entries (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    date TEXT NOT NULL,
    clockInTime TEXT NOT NULL,
    clockOutTime TEXT,
    breakMinutes INTEGER NOT NULL,
    totalHours REAL NOT NULL,
    overtimeHours REAL NOT NULL,
    workDescription TEXT NOT NULL,
    manualEntryFlag INTEGER NOT NULL,
    locationText TEXT,
    clockInGpsLat REAL,
    clockInGpsLng REAL,
    clockOutGpsLat REAL,
    clockOutGpsLng REAL,
    status TEXT NOT NULL,
    lockedAt TEXT,
    lockHash TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS photo_evidence (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    timeEntryId TEXT,
    localFilePath TEXT NOT NULL,
    caption TEXT,
    evidenceType TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    gpsLat REAL,
    gpsLng REAL,
    status TEXT NOT NULL,
    lockedAt TEXT,
    lockHash TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pay_summaries (
    id TEXT PRIMARY KEY,
    projectId TEXT,
    salaryPeriodStart TEXT NOT NULL,
    salaryPeriodEnd TEXT NOT NULL,
    basicPay REAL NOT NULL,
    overtimePay REAL NOT NULL,
    grossPay REAL NOT NULL,
    netPay REAL NOT NULL,
    itemisedPayslipJson TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL,
    lockedAt TEXT,
    lockHash TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS progress_claim_reports (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    claimPeriodStart TEXT NOT NULL,
    claimPeriodEnd TEXT NOT NULL,
    snapshotJson TEXT NOT NULL,
    totalClaimAmount REAL NOT NULL,
    status TEXT NOT NULL,
    lockedAt TEXT,
    lockHash TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS generated_documents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    filePath TEXT NOT NULL,
    sourceRecordId TEXT,
    hash TEXT NOT NULL,
    notes TEXT,
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS subscription_entitlements (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    planName TEXT NOT NULL,
    currentPeriodEnd TEXT,
    checkedAt TEXT NOT NULL
  )`
] as const;
```

- [ ] **Step 2: Add database initializer**

Create `mobile/src/db/localDatabase.ts` using Expo SQLite. Provide `openClaimProofDatabase()` and `initializeLocalDatabase()` functions that execute every schema statement in order.

- [ ] **Step 3: Add repository smoke helpers**

Create `mobile/src/db/repositories.ts` with:

```ts
export interface LocalRepositoryHealth {
  settingsCount: number;
  generatedDocumentCount: number;
}

export async function getLocalRepositoryHealth(): Promise<LocalRepositoryHealth> {
  return {
    settingsCount: 0,
    generatedDocumentCount: 0
  };
}
```

Replace the counts with real SQLite queries if Expo SQLite can be executed in the test/runtime environment.

- [ ] **Step 4: Add schema test**

Create `mobile/tests/localDatabase.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mobileSchemaStatements } from '../src/db/schema';

describe('mobile SQLite schema', () => {
  it('creates generated document and lock fields', () => {
    const sql = mobileSchemaStatements.join('\n');
    expect(sql).toContain('generated_documents');
    expect(sql).toContain('lockHash');
    expect(sql).toContain('lockedAt');
    expect(sql).toContain('subscription_entitlements');
  });
});
```

- [ ] **Step 5: Run verification and commit**

Run:

```powershell
npm.cmd run typecheck --workspace mobile
npm.cmd run test --workspace mobile
npm.cmd run test
```

Commit:

```bash
git add mobile/src/db mobile/tests/localDatabase.test.ts
git commit -m "feat: add mobile local database schema"
```

---

### Task 4: Secure Identifier Storage

**Files:**
- Create: `mobile/src/storage/secureIdentifiers.ts`
- Create: `mobile/tests/secureIdentifiers.test.ts`
- Modify: `mobile/src/screens/PrivacyScreen.tsx`

- [ ] **Step 1: Create SecureStore wrapper**

Create `mobile/src/storage/secureIdentifiers.ts`:

```ts
import * as SecureStore from 'expo-secure-store';

export interface SensitiveIdentifiers {
  workerIdentifier?: string;
  finNric?: string;
}

export function secureIdentifierKey(profileId: string): string {
  return `claimproof.identifiers.${profileId}`;
}

export async function saveSensitiveIdentifiers(profileId: string, identifiers: SensitiveIdentifiers): Promise<string> {
  const key = secureIdentifierKey(profileId);
  await SecureStore.setItemAsync(key, JSON.stringify(identifiers));
  return key;
}

export async function loadSensitiveIdentifiers(profileId: string): Promise<SensitiveIdentifiers | null> {
  const raw = await SecureStore.getItemAsync(secureIdentifierKey(profileId));
  if (!raw) return null;
  return JSON.parse(raw) as SensitiveIdentifiers;
}

export async function deleteSensitiveIdentifiers(profileId: string): Promise<void> {
  await SecureStore.deleteItemAsync(secureIdentifierKey(profileId));
}
```

- [ ] **Step 2: Add pure key test**

Create `mobile/tests/secureIdentifiers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { secureIdentifierKey } from '../src/storage/secureIdentifiers';

describe('secure identifier keys', () => {
  it('scopes sensitive identifier storage by profile id', () => {
    expect(secureIdentifierKey('profile-1')).toBe('claimproof.identifiers.profile-1');
  });
});
```

- [ ] **Step 3: Update privacy screen**

Ensure `PrivacyScreen` states that FIN, NRIC, and worker ID are stored in secure device storage rather than plain SQLite.

- [ ] **Step 4: Run verification and commit**

Run:

```powershell
npm.cmd run typecheck --workspace mobile
npm.cmd run test --workspace mobile
```

Commit:

```bash
git add mobile/src/storage/secureIdentifiers.ts mobile/tests/secureIdentifiers.test.ts mobile/src/screens/PrivacyScreen.tsx
git commit -m "feat: add secure identifier storage wrapper"
```

---

### Task 5: Evidence Lock Shared Utility

**Files:**
- Create: `shared/src/evidenceLock.ts`
- Create: `shared/tests/evidenceLock.test.ts`
- Modify: `shared/src/index.ts`
- Create: `mobile/src/screens/EvidenceLockScreen.tsx`

- [ ] **Step 1: Add canonical JSON and hash utility**

Create `shared/src/evidenceLock.ts`:

```ts
export interface EvidenceLockResult {
  canonicalJson: string;
  hash: string;
  lockedAt: string;
}

export async function createEvidenceLock(record: unknown, lockedAt = new Date().toISOString()): Promise<EvidenceLockResult> {
  const canonicalJson = stableStringify(record);
  const hash = await sha256(canonicalJson);
  return { canonicalJson, hash, lockedAt };
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

async function sha256(input: string): Promise<string> {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.subtle) {
    throw new Error('SHA-256 hashing is unavailable in this runtime');
  }
  const data = new TextEncoder().encode(input);
  const digest = await cryptoObject.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
```

- [ ] **Step 2: Export utility**

Modify `shared/src/index.ts`:

```ts
export * from './evidenceLock';
```

- [ ] **Step 3: Add evidence lock tests**

Create `shared/tests/evidenceLock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../src/evidenceLock';

describe('evidence lock', () => {
  it('creates canonical JSON independent of key order', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
  });
});
```

- [ ] **Step 4: Wire mobile evidence lock screen**

Update `mobile/src/screens/EvidenceLockScreen.tsx` to explain Draft, Finalized, and Locked statuses and show a sample lock hash generated from a local sample record.

- [ ] **Step 5: Run verification and commit**

Run:

```powershell
npm.cmd run test --workspace shared
npm.cmd run build --workspace shared
npm.cmd run typecheck --workspace mobile
npm.cmd run test
```

Commit:

```bash
git add shared/src/evidenceLock.ts shared/src/index.ts shared/tests/evidenceLock.test.ts mobile/src/screens/EvidenceLockScreen.tsx
git commit -m "feat: add evidence lock hashing utility"
```

---

### Task 6: Backup Export And Import Service

**Files:**
- Create: `mobile/src/backup/backupService.ts`
- Create: `mobile/tests/backupService.test.ts`
- Modify: `mobile/src/screens/SettingsBackupScreen.tsx`
- Modify: `shared/src/types.ts`

- [ ] **Step 1: Add backup types**

Modify `shared/src/types.ts`:

```ts
export interface ClaimProofBackupEnvelope {
  app: 'ClaimProof SG';
  version: 1;
  exportedAt: string;
  records: Record<string, unknown[]>;
  generatedDocuments: Array<{
    id: string;
    type: GeneratedDocumentType;
    filePath: string;
    hash: string;
    createdAt: string;
  }>;
}
```

- [ ] **Step 2: Create backup service**

Create `mobile/src/backup/backupService.ts`:

```ts
import type { ClaimProofBackupEnvelope } from '@claimproof/shared';

export function createBackupEnvelope(
  records: ClaimProofBackupEnvelope['records'],
  generatedDocuments: ClaimProofBackupEnvelope['generatedDocuments'],
  exportedAt = new Date().toISOString()
): ClaimProofBackupEnvelope {
  return {
    app: 'ClaimProof SG',
    version: 1,
    exportedAt,
    records,
    generatedDocuments
  };
}

export function parseBackupJson(input: string): ClaimProofBackupEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('Backup file is not valid JSON');
  }

  if (!isBackupEnvelope(parsed)) {
    throw new Error('Backup file is not a ClaimProof SG backup');
  }

  return parsed;
}

function isBackupEnvelope(value: unknown): value is ClaimProofBackupEnvelope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ClaimProofBackupEnvelope>;
  return candidate.app === 'ClaimProof SG' && candidate.version === 1 && typeof candidate.exportedAt === 'string';
}
```

- [ ] **Step 3: Add backup tests**

Create `mobile/tests/backupService.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createBackupEnvelope, parseBackupJson } from '../src/backup/backupService';

describe('backup service', () => {
  it('creates and parses a ClaimProof backup envelope', () => {
    const backup = createBackupEnvelope({ projects: [] }, []);
    expect(parseBackupJson(JSON.stringify(backup)).app).toBe('ClaimProof SG');
  });

  it('rejects malformed backup JSON', () => {
    expect(() => parseBackupJson('{bad')).toThrow('Backup file is not valid JSON');
  });
});
```

- [ ] **Step 4: Update backup screen**

`SettingsBackupScreen` must show the exact warning:

```text
ClaimProof SG stores records locally on this device. If you delete the app, change phone, or lose the device, your records may be lost unless you export or back them up.
```

It must include buttons labeled:

- `Export JSON Backup`
- `Import JSON Backup`

The import button can call a local handler that validates pasted/sample JSON in this first slice. Full file picker wiring can be added with Expo DocumentPicker in a later task if dependency scope is too large.

- [ ] **Step 5: Run verification and commit**

Run:

```powershell
npm.cmd run test --workspace mobile
npm.cmd run typecheck --workspace mobile
npm.cmd run test --workspace shared
```

Commit:

```bash
git add shared/src/types.ts mobile/src/backup mobile/tests/backupService.test.ts mobile/src/screens/SettingsBackupScreen.tsx
git commit -m "feat: add mobile backup export import foundation"
```

---

### Task 7: Local Files, Generated Documents, CSV, And Share Services

**Files:**
- Create: `shared/src/csvExport.ts`
- Create: `shared/tests/csvExport.test.ts`
- Create: `mobile/src/storage/localFiles.ts`
- Create: `mobile/src/reports/localExports.ts`
- Modify: `mobile/src/screens/StorageDiagnosticsScreen.tsx`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Add CSV helper**

Create `shared/src/csvExport.ts`:

```ts
export function toCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(','));
  }
  return lines.join('\n');
}

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}
```

- [ ] **Step 2: Add CSV tests**

Create `shared/tests/csvExport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toCsv } from '../src/csvExport';

describe('csv export', () => {
  it('escapes commas and quotes', () => {
    expect(toCsv([{ note: 'A, "quoted" note' }])).toBe('note\n"A, ""quoted"" note"');
  });
});
```

- [ ] **Step 3: Add local file service**

Create `mobile/src/storage/localFiles.ts` with functions:

```ts
export function reportFileName(prefix: string, extension: 'pdf' | 'csv' | 'json', now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${stamp}.${extension}`;
}
```

Expo FileSystem write/share wiring can be added once the mobile app is running on device/simulator.

- [ ] **Step 4: Add local export service**

Create `mobile/src/reports/localExports.ts`:

```ts
import { toCsv } from '@claimproof/shared';
import { reportFileName } from '../storage/localFiles';

export function buildTimeEntriesCsv(rows: Array<Record<string, string | number | null | undefined>>): {
  fileName: string;
  contents: string;
} {
  return {
    fileName: reportFileName('time-entries', 'csv'),
    contents: toCsv(rows)
  };
}
```

- [ ] **Step 5: Update diagnostics screen**

Show these storage categories:

- SQLite records
- Secure identifiers
- Local photos
- Generated documents
- JSON backups

- [ ] **Step 6: Run verification and commit**

Run:

```powershell
npm.cmd run test --workspace shared
npm.cmd run test --workspace mobile
npm.cmd run typecheck --workspace mobile
```

Commit:

```bash
git add shared/src/csvExport.ts shared/src/index.ts shared/tests/csvExport.test.ts mobile/src/storage/localFiles.ts mobile/src/reports/localExports.ts mobile/src/screens/StorageDiagnosticsScreen.tsx
git commit -m "feat: add local export service foundation"
```

---

### Task 8: Stripe Subscription Backend Foundation

**Files:**
- Modify: `server/package.json`
- Modify: `server/src/config/env.ts`
- Modify: `server/prisma/schema.prisma`
- Create: `server/src/modules/subscriptions/subscription.routes.ts`
- Create: `server/src/modules/subscriptions/subscription.service.ts`
- Modify: `server/src/app.ts`
- Create: `server/tests/subscriptions.test.ts`

- [ ] **Step 1: Add Stripe dependency**

Install:

```powershell
npm.cmd install stripe --workspace server
```

- [ ] **Step 2: Add environment fields**

Extend `server/src/config/env.ts` with optional values:

```ts
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID_BASIC_MONTHLY
STRIPE_CUSTOMER_PORTAL_RETURN_URL
STRIPE_CHECKOUT_SUCCESS_URL
STRIPE_CHECKOUT_CANCEL_URL
```

The server must still start in local development when Stripe env vars are missing. Stripe endpoints should return a clear `503` configuration error when required values are absent.

- [ ] **Step 3: Extend Prisma schema**

Add a model:

```prisma
model SubscriptionEntitlement {
  id                   String   @id @default(cuid())
  userId               String
  stripeCustomerId     String?
  stripeSubscriptionId String?
  status               String
  planName             String
  currentPeriodEnd     DateTime?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId])
  @@index([stripeCustomerId])
  @@index([stripeSubscriptionId])
}
```

Add `subscriptionEntitlement SubscriptionEntitlement?` to `User`.

- [ ] **Step 4: Add subscription service**

Create service methods:

```ts
getSubscriptionStatus(userId: string)
createCheckoutSession(userId: string, email: string)
handleStripeWebhook(rawBody: Buffer, signature: string | undefined)
```

The checkout method uses `STRIPE_PRICE_ID_BASIC_MONTHLY` and does not hard-code a launch price.

- [ ] **Step 5: Add routes**

Create routes:

- `GET /subscriptions/status`
- `POST /subscriptions/checkout-session`
- `POST /subscriptions/webhook`

Mobile uses only status in this phase.

- [ ] **Step 6: Add tests**

Tests must cover:

- Status returns free/inactive when no entitlement exists.
- Checkout returns `503` when Stripe is not configured.
- User ownership is enforced through `requireUser`.

- [ ] **Step 7: Run verification and commit**

Run:

```powershell
$env:DATABASE_URL='file:./dev.db'
npm.cmd exec --workspace server -- prisma validate
npm.cmd run test --workspace server -- subscriptions
npm.cmd run test
npm.cmd run build
```

Commit:

```bash
git add server/package.json package-lock.json server/prisma server/src/config/env.ts server/src/modules/subscriptions server/src/app.ts server/tests/subscriptions.test.ts
git commit -m "feat: add Stripe subscription foundation"
```

---

### Task 9: Mobile Subscription Status Screen

**Files:**
- Create: `mobile/src/subscription/subscriptionStatus.ts`
- Modify: `mobile/src/screens/SubscriptionScreen.tsx`
- Create: `mobile/tests/subscriptionStatus.test.ts`

- [ ] **Step 1: Add local subscription status types**

Create `mobile/src/subscription/subscriptionStatus.ts`:

```ts
export type LocalSubscriptionStatus = 'FREE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNKNOWN';

export interface LocalSubscriptionEntitlement {
  status: LocalSubscriptionStatus;
  planName: string;
  currentPeriodEnd?: string | null;
  checkedAt: string;
}

export function defaultSubscriptionEntitlement(now = new Date().toISOString()): LocalSubscriptionEntitlement {
  return {
    status: 'FREE',
    planName: 'ClaimProof SG Free',
    checkedAt: now
  };
}
```

- [ ] **Step 2: Update subscription screen**

`SubscriptionScreen` must:

- Show current local status.
- Show ClaimProof SG Basic as configurable subscription foundation.
- State that final mobile store billing path is not enabled yet.
- Avoid direct Stripe checkout button inside the mobile app.
- Mention launch pricing is under review, with Free + S$4.99/month or S$49/year as candidate pricing.

- [ ] **Step 3: Add test**

Create `mobile/tests/subscriptionStatus.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSubscriptionEntitlement } from '../src/subscription/subscriptionStatus';

describe('mobile subscription status', () => {
  it('defaults to free local entitlement', () => {
    expect(defaultSubscriptionEntitlement('2026-06-09T00:00:00.000Z')).toEqual({
      status: 'FREE',
      planName: 'ClaimProof SG Free',
      checkedAt: '2026-06-09T00:00:00.000Z'
    });
  });
});
```

- [ ] **Step 4: Run verification and commit**

Run:

```powershell
npm.cmd run test --workspace mobile
npm.cmd run typecheck --workspace mobile
```

Commit:

```bash
git add mobile/src/subscription mobile/src/screens/SubscriptionScreen.tsx mobile/tests/subscriptionStatus.test.ts
git commit -m "feat: add mobile subscription status screen"
```

---

### Task 10: App Store Privacy And Backup Documents

**Files:**
- Create: `docs/MOBILE_APP_STORE_PLAN.md`
- Create: `docs/PRIVACY_DISCLOSURE_DRAFT.md`
- Create: `docs/DATA_SAFETY_NOTES.md`
- Create: `docs/LOCAL_STORAGE_BACKUP_POLICY.md`

- [ ] **Step 1: Create mobile app store plan**

`docs/MOBILE_APP_STORE_PLAN.md` must include:

- Expo build path.
- Apple TestFlight path.
- Android Internal Testing path.
- Permissions list.
- Billing policy decision before launch.
- Required screenshots and privacy forms.

- [ ] **Step 2: Create privacy disclosure draft**

`docs/PRIVACY_DISCLOSURE_DRAFT.md` must state:

- Records are local by default.
- Photos stay on device unless user shares/exports.
- GPS is optional.
- Secure identifiers use secure device storage.
- Subscription checks may contact backend/Stripe if enabled.
- No analytics in V1.

- [ ] **Step 3: Create data safety notes**

`docs/DATA_SAFETY_NOTES.md` must map data categories:

- Personal info: name, phone, optional FIN/NRIC/worker ID.
- Financial info: pay summaries and rates.
- Photos/videos: evidence photos.
- Location: optional GPS.
- Files/docs: PDFs, CSVs, backups.

For each category, state whether it is collected by the developer, shared, encrypted, optional, and user-deletable.

- [ ] **Step 4: Create local storage backup policy**

`docs/LOCAL_STORAGE_BACKUP_POLICY.md` must include the exact warning:

```text
ClaimProof SG stores records locally on this device. If you delete the app, change phone, or lose the device, your records may be lost unless you export or back them up.
```

It must describe export JSON, import JSON, generated document archive, and user responsibility.

- [ ] **Step 5: Run docs scan and commit**

Run:

```powershell
Select-String -Path docs\\MOBILE_APP_STORE_PLAN.md,docs\\PRIVACY_DISCLOSURE_DRAFT.md,docs\\DATA_SAFETY_NOTES.md,docs\\LOCAL_STORAGE_BACKUP_POLICY.md -Pattern 'ClaimProof SG stores records locally'
```

Expected:

- The backup policy contains the exact warning.

Commit:

```bash
git add docs/MOBILE_APP_STORE_PLAN.md docs/PRIVACY_DISCLOSURE_DRAFT.md docs/DATA_SAFETY_NOTES.md docs/LOCAL_STORAGE_BACKUP_POLICY.md
git commit -m "docs: add mobile app store privacy and backup docs"
```

---

### Task 11: Final Verification And README Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm.cmd run test
npm.cmd run build
npm.cmd run test --workspace shared
npm.cmd run build --workspace shared
npm.cmd run test --workspace mobile
npm.cmd run typecheck --workspace mobile
```

Expected:

- Existing server tests pass.
- Existing client tests pass.
- Shared tests/build pass.
- Mobile tests/typecheck pass.

- [ ] **Step 2: Update README**

Add:

- Recommended mobile architecture.
- Whether `/mobile` Expo app was created.
- Local storage implementation status.
- Photo storage implementation status.
- PDF/CSV local export status.
- Native share/export status.
- App Store readiness docs created.
- Remaining App Store / Google Play work.
- Commands to run and test mobile app.
- Stripe subscription status and policy gate.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update mobile architecture runbook"
```

---

## Self-Review

Spec coverage:

- Option A `/mobile` Expo app: Tasks 2 and 11.
- `/shared` reusable logic: Tasks 1, 5, 6, and 7.
- SQLite local storage: Task 3.
- Local photo/report storage foundation: Task 7.
- Backup export and import as V1: Task 6.
- Generated document archive: Task 3 and Task 7.
- Evidence Lock: Task 3 and Task 5.
- Secure identifiers: Task 4.
- Native share/export foundation: Task 7.
- Stripe subscription foundation: Tasks 8 and 9.
- Pricing not hard-coded: Tasks 8 and 9.
- App Store / Play docs: Task 10.
- Current web/server app remains verified: Tasks 1, 8, and 11.

Placeholder scan:

- This plan avoids unresolved `TBD` and `TODO` markers.
- Mobile billing remains a policy-gated status screen by design, not an accidental incomplete payment flow.
- Import backup is included as a V1 task.

Type consistency:

- `RecordStatus` includes `DRAFT`, `FINALIZED`, and `LOCKED`.
- `GeneratedDocumentType` names match SQLite document type strings.
- Backup envelope version is fixed at `1` for the first mobile backup format.
