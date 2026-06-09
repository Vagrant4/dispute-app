import { createEvidenceLock, type EvidenceHashProvider } from "../evidence/evidenceLock";
import {
  type GeneratedDocumentType,
  type InsertGeneratedDocumentParams,
} from "./generatedDocumentRepository";
import type { ProgressClaimSnapshot } from "./progressClaimTypes";

export async function buildGeneratedDocumentArchiveInput(params: {
  id: string;
  userId: string;
  type: GeneratedDocumentType;
  filePath: string;
  snapshot: ProgressClaimSnapshot;
  metadata?: Record<string, unknown>;
  hashProviders?: readonly EvidenceHashProvider[];
}): Promise<InsertGeneratedDocumentParams> {
  const metadata = {
    ...(params.metadata ?? {}),
    appStorage: "local-device",
    autoEmail: false,
    cloudUpload: false,
  };
  const lock = await createEvidenceLock(
    {
      documentType: params.type,
      filePath: params.filePath,
      metadata,
      snapshot: params.snapshot,
    },
    params.snapshot.generatedAt,
    { hashProviders: params.hashProviders },
  );

  return {
    id: params.id,
    userId: params.userId,
    projectId: params.snapshot.project.id ?? null,
    type: params.type,
    fileName: getFileName(params.filePath),
    filePath: params.filePath,
    hash: lock.hash,
    periodStart: params.snapshot.claimPeriod.start,
    periodEnd: params.snapshot.claimPeriod.end,
    metadata,
    snapshot: params.snapshot,
    status: "finalized",
  };
}

export function createGeneratedDocumentId(prefix = "document"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getFileName(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}
