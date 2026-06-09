import { createEvidenceLock, type EvidenceRecord } from "./evidenceLock";

export const EVIDENCE_LOCK_STATUS = "LOCKED" as const;

export type EvidenceLockStatus = typeof EVIDENCE_LOCK_STATUS;

export type LockableLocalRow = EvidenceRecord & {
  id: string;
  status?: string | null;
  lockHash?: string | null;
  lock_hash?: string | null;
  lockedAt?: string | null;
  locked_at?: string | null;
};

export type EvidenceLockUpdate = {
  lockHash: string;
  lockedAt: string;
  status: EvidenceLockStatus;
};

export async function buildEvidenceLockUpdate(
  row: LockableLocalRow,
  lockedAt?: string,
): Promise<EvidenceLockUpdate> {
  assertCanUpdateUnlockedRecord(row);

  const lock = await createEvidenceLock(getLockableEvidencePayload(row), lockedAt);

  return {
    lockHash: lock.hash,
    lockedAt: lock.lockedAt,
    status: EVIDENCE_LOCK_STATUS,
  };
}

export function assertCanUpdateUnlockedRecord(row: Pick<LockableLocalRow, "status">): void {
  if (row.status === EVIDENCE_LOCK_STATUS) {
    throw new Error("Locked evidence records are read-only and cannot be edited.");
  }
}

export function getLockableEvidencePayload(row: LockableLocalRow): EvidenceRecord {
  const {
    lockHash: _lockHash,
    lock_hash: _lockHashSnake,
    lockedAt: _lockedAt,
    locked_at: _lockedAtSnake,
    status: _status,
    ...payload
  } = row;

  return payload;
}
