import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

loadLocalEnv();

export const prisma = new PrismaClient();

function loadLocalEnv(): void {
  if (process.env.DATABASE_URL) return;

  for (const envPath of [join(process.cwd(), '.env'), join(process.cwd(), 'server', '.env')]) {
    if (!existsSync(envPath)) continue;

    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key]) continue;

      process.env[key] = rawValue.replace(/^"(.*)"$/, '$1');
    }

    if (process.env.DATABASE_URL) return;
  }
}
