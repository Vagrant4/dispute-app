import { createEvidenceLock, type EvidenceRecord } from "./evidenceLock";

export const EVIDENCE_LOCK_STATUS = "locked" as const;

const EDITABLE_EVIDENCE_STATUSES = new Set(["active", "draft", "finalized", "inactive"]);

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
  if (typeof row.status !== "string" || row.status.trim().length === 0) {
    throw new Error("Evidence record status is required before editing.");
  }

  const normalizedStatus = row.status.toLowerCase();

  if (normalizedStatus === EVIDENCE_LOCK_STATUS) {
    throw new Error("Locked evidence records are read-only and cannot be edited.");
  }

  if (!EDITABLE_EVIDENCE_STATUSES.has(normalizedStatus)) {
    throw new Error(`Unsupported evidence record status: ${row.status}.`);
  }
}

export function getLockableEvidencePayload(row: LockableLocalRow): EvidenceRecord {
  const {
    createdAt: _createdAt,
    created_at: _createdAtSnake,
    lockHash: _lockHash,
    lock_hash: _lockHashSnake,
    lockedAt: _lockedAt,
    locked_at: _lockedAtSnake,
    status: _status,
    updatedAt: _updatedAt,
    updated_at: _updatedAtSnake,
    ...payload
  } = row;

  return payload;
}
