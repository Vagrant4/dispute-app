import type { LocalDatabase } from "../db/localDatabase";
import {
  buildPhotoEvidenceInput,
  type BuildPhotoEvidenceInputParams,
  type PhotoEvidenceInput,
} from "./photoEvidenceTypes";

export type PhotoEvidenceRow = {
  id: string;
  user_id: string;
  project_id: string;
  time_entry_id: string | null;
  local_uri: string;
  caption: string | null;
  evidence_type: string;
  captured_at: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  gps_message: string | null;
  status: string;
  lock_hash?: string | null;
  locked_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export class PhotoEvidenceRepository {
  constructor(private readonly database: LocalDatabase) {}

  async insertPhotoEvidence(
    params: BuildPhotoEvidenceInputParams | PhotoEvidenceInput,
  ): Promise<void> {
    const input =
      "capturedAt" in params ? validatePhotoEvidenceInput(params) : buildPhotoEvidenceInput(params);

    await this.database.runAsync(
      `INSERT INTO photo_evidence (
        id,
        user_id,
        project_id,
        time_entry_id,
        local_uri,
        caption,
        evidence_type,
        captured_at,
        gps_latitude,
        gps_longitude,
        gps_message,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.projectId,
        input.timeEntryId,
        input.localUri,
        input.caption,
        input.evidenceType,
        input.capturedAt,
        input.gpsLatitude,
        input.gpsLongitude,
        input.gpsMessage,
        input.status,
      ],
    );
  }

  async listRecentPhotoEvidence(params: {
    userId: string;
    limit?: number;
  }): Promise<PhotoEvidenceRow[]> {
    const limit = Math.max(1, Math.min(params.limit ?? 20, 100));

    return this.database.getAllAsync<PhotoEvidenceRow>(
      `SELECT
        id,
        user_id,
        project_id,
        time_entry_id,
        local_uri,
        caption,
        evidence_type,
        captured_at,
        gps_latitude,
        gps_longitude,
        gps_message,
        status,
        lock_hash,
        locked_at,
        created_at,
        updated_at
      FROM photo_evidence
      WHERE user_id = ?
      ORDER BY COALESCE(captured_at, created_at) DESC
      LIMIT ?`,
      [params.userId, limit],
    );
  }

  async deletePhotoEvidence(params: { id: string; userId: string }): Promise<void> {
    await this.database.runAsync(
      "DELETE FROM photo_evidence WHERE id = ? AND user_id = ?",
      [params.id, params.userId],
    );
  }
}

function validatePhotoEvidenceInput(input: PhotoEvidenceInput): PhotoEvidenceInput {
  return buildPhotoEvidenceInput({
    id: input.id,
    userId: input.userId,
    projectId: input.projectId,
    timeEntryId: input.timeEntryId,
    timeEntryProjectId: input.timeEntryProjectId,
    localUri: input.localUri,
    caption: input.caption,
    evidenceType: input.evidenceType,
    timestamp: input.capturedAt,
    gps: {
      coordinates:
        input.gpsLatitude == null || input.gpsLongitude == null
          ? null
          : {
              latitude: input.gpsLatitude,
              longitude: input.gpsLongitude,
            },
      message: input.gpsMessage ?? "",
      blocked: false,
    },
    status: input.status,
  });
}
