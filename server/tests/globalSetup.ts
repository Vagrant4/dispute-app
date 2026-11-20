import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const testDatabaseUrl = 'file:./test.db';
const testDatabasePath = fileURLToPath(new URL('../prisma/test.db', import.meta.url));
const testDatabaseJournalPath = fileURLToPath(new URL('../prisma/test.db-journal', import.meta.url));
const serverRoot = fileURLToPath(new URL('..', import.meta.url));
const prismaCliPath = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));

function removeTestDatabase(): void {
  rmSync(testDatabasePath, { force: true });
  rmSync(testDatabaseJournalPath, { force: true });
  rmSync(`${testDatabasePath}-shm`, { force: true });
  rmSync(`${testDatabasePath}-wal`, { force: true });
}

export default function setup() {
  removeTestDatabase();

  // A single migration-engine invocation applies the real ordered migration chain
  // and exits before Vitest starts. The former per-file `db execute` loop left
  // Windows child processes and the shared SQLite file in contention, so Vitest
  // never reached its test collection phase.
  execFileSync(
    process.execPath,
    [prismaCliPath, 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
    {
      cwd: serverRoot,
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'inherit'
    }
  );

  return () => {
    removeTestDatabase();
  };
}
