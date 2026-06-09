export const EVIDENCE_TYPES = [
  "BEFORE_WORK",
  "DURING_WORK",
  "AFTER_WORK",
  "DEFECT",
  "COMPLETED_WORK",
  "MATERIAL_DELIVERY",
  "VARIATION_WORK",
  "OTHER",
] as const;

export type PhotoEvidenceType = (typeof EVIDENCE_TYPES)[number];

export type PhotoGpsCoordinates = {
  latitude: number;
  longitude: number;
};

export type PhotoGpsResult = {
  coordinates: PhotoGpsCoordinates | null;
  message: string;
  blocked: false;
};

export type BuildPhotoEvidenceInputParams = {
  id: string;
  userId: string;
  projectId: string;
  timeEntryId?: string | null;
  timeEntryProjectId?: string | null;
  localUri: string;
  caption?: string | null;
  evidenceType?: PhotoEvidenceType;
  timestamp?: string;
  gps?: PhotoGpsResult | null;
  status?: "draft" | "active" | "finalized";
};

export type PhotoEvidenceInput = {
  id: string;
  userId: string;
  projectId: string;
  timeEntryId: string | null;
  timeEntryProjectId: string | null;
  localUri: string;
  caption: string | null;
  evidenceType: PhotoEvidenceType;
  capturedAt: string;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsMessage: string | null;
  status: "draft" | "active" | "finalized";
};

const EVIDENCE_TYPE_SET = new Set<string>(EVIDENCE_TYPES);

export function isPhotoEvidenceType(value: unknown): value is PhotoEvidenceType {
  return typeof value === "string" && EVIDENCE_TYPE_SET.has(value);
}

export function assertPhotoEvidenceType(
  value: unknown,
): asserts value is PhotoEvidenceType {
  if (!isPhotoEvidenceType(value)) {
    throw new Error(`Unsupported photo evidence type: ${String(value)}.`);
  }
}

export function buildPhotoEvidenceInput(
  params: BuildPhotoEvidenceInputParams,
): PhotoEvidenceInput {
  const projectId = requireNonEmpty(params.projectId, "projectId");
  const userId = requireNonEmpty(params.userId, "userId");
  const id = requireNonEmpty(params.id, "id");
  const localUri = requireNonEmpty(params.localUri, "localUri");
  const timeEntryId = normalizeOptionalText(params.timeEntryId);
  const timeEntryProjectId = normalizeOptionalText(params.timeEntryProjectId);

  if (timeEntryId && timeEntryProjectId !== projectId) {
    throw new Error("timeEntryId must belong to the same projectId.");
  }

  const evidenceType = params.evidenceType ?? "OTHER";
  assertPhotoEvidenceType(evidenceType);

  return {
    id,
    userId,
    projectId,
    timeEntryId,
    timeEntryProjectId,
    localUri,
    caption: normalizeOptionalText(params.caption),
    evidenceType,
    capturedAt: params.timestamp ?? new Date().toISOString(),
    gpsLatitude: params.gps?.coordinates?.latitude ?? null,
    gpsLongitude: params.gps?.coordinates?.longitude ?? null,
    gpsMessage: normalizeOptionalText(params.gps?.message),
    status: params.status ?? "draft",
  };
}

function requireNonEmpty(value: string, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
