import type { LocalDatabase } from "../db/localDatabase";

export type GeneratedDocumentType =
  | "progress_claim_pdf"
  | "progress_claim_csv";

export type GeneratedDocumentRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  document_type: string;
  file_name: string;
  local_uri: string | null;
  file_hash: string | null;
  period_start: string | null;
  period_end: string | null;
  metadata_json: string | null;
  snapshot_json: string | null;
  status: string;
  lock_hash?: string | null;
  locked_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type InsertGeneratedDocumentParams = {
  id: string;
  userId: string;
  projectId?: string | null;
  type: GeneratedDocumentType;
  fileName: string;
  filePath?: string | null;
  hash?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  metadata?: Record<string, unknown> | null;
  snapshot?: unknown;
  status?: string;
};

export class GeneratedDocumentRepository {
  constructor(private readonly database: LocalDatabase) {}

  async insertGeneratedDocument(
    params: InsertGeneratedDocumentParams,
  ): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO generated_documents (
        id,
        user_id,
        project_id,
        document_type,
        file_name,
        local_uri,
        file_hash,
        period_start,
        period_end,
        metadata_json,
        snapshot_json,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        params.userId,
        params.projectId ?? null,
        params.type,
        params.fileName,
        params.filePath ?? null,
        params.hash ?? null,
        params.periodStart ?? null,
        params.periodEnd ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.snapshot === undefined ? null : JSON.stringify(params.snapshot),
        params.status ?? "finalized",
      ],
    );
  }

  async listRecentGeneratedDocuments(params: {
    userId: string;
    limit?: number;
  }): Promise<GeneratedDocumentRow[]> {
    const limit = Math.max(1, Math.min(params.limit ?? 20, 100));

    return this.database.getAllAsync<GeneratedDocumentRow>(
      `SELECT
        id,
        user_id,
        project_id,
        document_type,
        file_name,
        local_uri,
        file_hash,
        period_start,
        period_end,
        metadata_json,
        snapshot_json,
        status,
        lock_hash,
        locked_at,
        created_at,
        updated_at
      FROM generated_documents
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
      [params.userId, limit],
    );
  }

  async getGeneratedDocumentById(params: {
    id: string;
    userId: string;
  }): Promise<GeneratedDocumentRow | null> {
    const row = await this.database.getFirstAsync<GeneratedDocumentRow>(
      `SELECT
        id,
        user_id,
        project_id,
        document_type,
        file_name,
        local_uri,
        file_hash,
        period_start,
        period_end,
        metadata_json,
        snapshot_json,
        status,
        lock_hash,
        locked_at,
        created_at,
        updated_at
      FROM generated_documents
      WHERE id = ? AND user_id = ?`,
      [params.id, params.userId],
    );

    return row ?? null;
  }

  async deleteGeneratedDocument(params: {
    id: string;
    userId: string;
  }): Promise<void> {
    await this.database.runAsync(
      "DELETE FROM generated_documents WHERE id = ? AND user_id = ?",
      [params.id, params.userId],
    );
  }
}
