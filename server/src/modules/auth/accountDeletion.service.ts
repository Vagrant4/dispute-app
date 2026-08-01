import { randomUUID } from 'node:crypto';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { AuthServiceError } from './auth.service.js';

type StagedDirectory = {
  originalPath: string;
  stagedPath: string;
};

export type AccountDeletionResult = {
  requestId: string;
  deletedAt: Date;
  storageCleanupComplete: boolean;
};

export async function deleteAccountForAuthenticatedUser(input: {
  userId: string;
  password: string;
  requestId?: string;
}): Promise<AccountDeletionResult> {
  const requestId = normalizeRequestId(input.requestId);
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AuthServiceError('Current password is incorrect', 401);
  }

  return permanentlyDeleteUser(user.id, requestId);
}

export async function deleteAccountWithCredentials(input: {
  email: string;
  password: string;
  requestId?: string;
}): Promise<AccountDeletionResult> {
  const requestId = normalizeRequestId(input.requestId);
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AuthServiceError('Invalid email or password', 401);
  }

  return permanentlyDeleteUser(user.id, requestId);
}

async function permanentlyDeleteUser(userId: string, requestedId?: string): Promise<AccountDeletionResult> {
  const requestId = normalizeRequestId(requestedId);
  const existingReceipt = await prisma.accountDeletionReceipt.findUnique({
    where: { id: requestId }
  });
  if (existingReceipt) {
    throw new AuthServiceError('Deletion request ID has already been used', 409);
  }

  await deleteRevenueCatCustomer({
    appUserId: userId,
    nodeEnv: env.nodeEnv,
    secretApiKey: env.revenueCat.secretApiKey
  });

  const stagedDirectories = await stageAccountStorage(userId, requestId);
  let receipt;
  try {
    receipt = await prisma.$transaction(async (tx) => {
      const created = await tx.accountDeletionReceipt.create({
        data: { id: requestId }
      });
      await tx.user.delete({ where: { id: userId } });
      return created;
    });
  } catch (error) {
    await restoreStagedDirectories(stagedDirectories);
    throw error;
  }

  const storageCleanupComplete = await removeStagedDirectories(stagedDirectories);
  if (storageCleanupComplete) {
    receipt = await prisma.accountDeletionReceipt.update({
      where: { id: requestId },
      data: { storageCleanupComplete: true }
    });
  } else {
    schedulePendingStorageCleanup(requestId);
  }

  return toAccountDeletionResult(receipt);
}

export async function getAccountDeletionStatus(
  requestedId: string
): Promise<AccountDeletionResult | null> {
  const requestId = parseRequestId(requestedId);
  if (!requestId) return null;

  let receipt = await prisma.accountDeletionReceipt.findUnique({
    where: { id: requestId }
  });
  if (!receipt) return null;

  if (!receipt.storageCleanupComplete) {
    const storageCleanupComplete = await removeStagedDirectories(
      pendingStagedDirectories(requestId)
    );
    if (storageCleanupComplete) {
      receipt = await prisma.accountDeletionReceipt.update({
        where: { id: requestId },
        data: { storageCleanupComplete: true }
      });
    }
  }

  return toAccountDeletionResult(receipt);
}

export async function deleteRevenueCatCustomer(input: {
  appUserId: string;
  nodeEnv: string;
  secretApiKey: string;
  fetcher?: typeof fetch;
}): Promise<void> {
  if (!input.secretApiKey) {
    if (input.nodeEnv === 'production') {
      throw new AuthServiceError(
        'Account deletion is temporarily unavailable because subscription data deletion is not configured',
        503
      );
    }
    return;
  }

  const response = await (input.fetcher ?? fetch)(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(input.appUserId)}`,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.secretApiKey}`
      }
    }
  );
  if (response.ok || response.status === 404) return;

  throw new AuthServiceError(
    'Unable to complete subscription data deletion. No Dispute account data was deleted.',
    502
  );
}

function toAccountDeletionResult(receipt: {
  id: string;
  deletedAt: Date;
  storageCleanupComplete: boolean;
}): AccountDeletionResult {
  return {
    requestId: receipt.id,
    deletedAt: receipt.deletedAt,
    storageCleanupComplete: receipt.storageCleanupComplete
  };
}

async function stageAccountStorage(userId: string, requestId: string): Promise<StagedDirectory[]> {
  const roots = accountStorageRoots();
  const stagedDirectories: StagedDirectory[] = [];

  try {
    for (const root of roots) {
      const originalPath = join(root, userId);
      if (!(await pathExists(originalPath))) continue;

      const stagedRoot = join(root, '.pending-account-deletion');
      const stagedPath = join(stagedRoot, requestId);
      await mkdir(stagedRoot, { recursive: true });
      await rm(stagedPath, { force: true, recursive: true });
      await rename(originalPath, stagedPath);
      stagedDirectories.push({ originalPath, stagedPath });
    }
    return stagedDirectories;
  } catch (error) {
    await restoreStagedDirectories(stagedDirectories);
    throw error;
  }
}

function accountStorageRoots(): string[] {
  return [...new Set([
    resolve(env.uploadRoot),
    resolve(process.env.EXPORT_ROOT ?? join(process.cwd(), 'src', 'exports'))
  ])];
}

function pendingStagedDirectories(requestId: string): StagedDirectory[] {
  return accountStorageRoots().map((root) => ({
    originalPath: '',
    stagedPath: join(root, '.pending-account-deletion', requestId)
  }));
}

async function restoreStagedDirectories(directories: StagedDirectory[]): Promise<void> {
  for (const directory of [...directories].reverse()) {
    if (!(await pathExists(directory.stagedPath))) continue;
    await mkdir(resolve(directory.originalPath, '..'), { recursive: true });
    await rename(directory.stagedPath, directory.originalPath);
  }
}

async function removeStagedDirectories(directories: StagedDirectory[]): Promise<boolean> {
  try {
    await Promise.all(
      directories.map((directory) => rm(directory.stagedPath, { force: true, recursive: true }))
    );
    return true;
  } catch (error) {
    console.error('Account deletion storage cleanup is pending', error);
    return false;
  }
}

function schedulePendingStorageCleanup(requestId: string): void {
  for (const delayMs of [5_000, 30_000, 120_000]) {
    const timer = setTimeout(() => {
      void getAccountDeletionStatus(requestId).catch((error) => {
        console.error('Account deletion storage cleanup retry failed', error);
      });
    }, delayMs);
    timer.unref();
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeRequestId(value?: string): string {
  return parseRequestId(value) ?? randomUUID();
}

function parseRequestId(value?: string): string | null {
  const requestId = value?.trim();
  return requestId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    ? requestId
    : null;
}
