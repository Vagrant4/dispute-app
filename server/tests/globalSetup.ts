import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const testDatabaseUrl = 'file:./test.db';
const testDatabasePath = fileURLToPath(new URL('../prisma/test.db', import.meta.url));
const testDatabaseJournalPath = fileURLToPath(new URL('../prisma/test.db-journal', import.meta.url));
const serverRoot = fileURLToPath(new URL('..', import.meta.url));
const prismaCliPath = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));
const migrationsPath = fileURLToPath(new URL('../prisma/migrations', import.meta.url));

function removeTestDatabase(): void {
  rmSync(testDatabasePath, { force: true });
  rmSync(testDatabaseJournalPath, { force: true });
}

export default function setup() {
  removeTestDatabase();

  const migrations = readdirSync(migrationsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migration of migrations) {
    execFileSync(
      process.execPath,
      [
        prismaCliPath,
        'db',
        'execute',
        '--schema',
        'prisma/schema.prisma',
        '--file',
        `prisma/migrations/${migration}/migration.sql`
      ],
      {
        cwd: serverRoot,
        env: {
          ...process.env,
          DATABASE_URL: testDatabaseUrl
        },
        stdio: 'inherit'
      }
    );
  }

  return () => {
    removeTestDatabase();
  };
}
