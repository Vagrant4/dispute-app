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
  captured_at: string | null;
  capture_source?: string | null;
  capture_time_source?: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  gps_message: string | null;
  gps_accuracy_m?: number | null;
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
        gps_accuracy_m,
        status,
        capture_source,
        capture_time_source,
        lock_hash,
        locked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        input.gpsAccuracyM ?? null,
        input.status,
        input.captureSource ?? null,
        input.captureTimeSource ?? null,
        input.lockHash ?? null,
        input.lockedAt ?? null,
      ],
    );
  }

  async listRecentPhotoEvidence(params: {
    userId: string;
    limit?: number;
  }): Promise<PhotoEvidenceRow[]> {
    const limit = params.limit == null ? -1 : Math.max(1, Math.min(params.limit, 100));

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
        gps_accuracy_m,
        status,
        capture_source,
        capture_time_source,
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
    const eventAt = new Date().toISOString();
    await this.database.runAsync(
      `INSERT INTO evidence_audit (id, user_id, project_id, time_entry_id, photo_id, event_type, event_at, captured_at, message)
       SELECT ?, user_id, project_id, time_entry_id, id, 'photo_deleted', ?, captured_at, 'Photo deleted at ' || ? || CASE WHEN captured_at IS NOT NULL THEN ' (captured ' || captured_at || ')' ELSE ' (capture time unavailable)' END FROM photo_evidence WHERE id = ? AND user_id = ?`,
      [`audit-${params.id}-${Date.now()}`, eventAt, new Date(eventAt).toLocaleString(), params.id, params.userId],
    );
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
    captureSource: input.captureSource,
    captureTimeSource: input.captureTimeSource,
    lockHash: input.lockHash,
    lockedAt: input.lockedAt,
    gps: {
      coordinates:
        input.gpsLatitude == null || input.gpsLongitude == null
          ? null
          : {
              latitude: input.gpsLatitude,
              longitude: input.gpsLongitude,
              accuracy: input.gpsAccuracyM ?? null,
            },
      message: input.gpsMessage ?? "",
      blocked: false,
    },
    status: input.status,
  });
}
