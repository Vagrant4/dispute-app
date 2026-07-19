import * as FileSystem from "expo-file-system/legacy";

export type EvidencePhotoPathParams = {
  userId: string;
  projectId: string;
  photoId: string;
  extension?: string;
  baseDirectory?: string | null;
};

export type ImportedEvidencePhoto = {
  localUri: string;
  copied: boolean;
  message: string;
};

export function buildEvidencePhotoPath(params: EvidencePhotoPathParams): string {
  const baseDirectory =
    params.baseDirectory ?? FileSystem.documentDirectory ?? "file:///";
  const extension = sanitizePathSegment(params.extension ?? "jpg").replace(/^\.+/, "");
  const normalizedBase = baseDirectory.endsWith("/")
    ? baseDirectory
    : `${baseDirectory}/`;

  return [
    normalizedBase.replace(/\/+$/, ""),
    "evidence-photos",
    sanitizePathSegment(params.userId),
    sanitizePathSegment(params.projectId),
    `${sanitizePathSegment(params.photoId)}.${extension || "jpg"}`,
  ].join("/");
}

export async function importEvidencePhotoFile(params: {
  sourceUri: string;
  destinationUri: string;
}): Promise<ImportedEvidencePhoto> {
  if (!FileSystem.copyAsync || !FileSystem.makeDirectoryAsync) {
    return {
      localUri: params.sourceUri,
      copied: false,
      message: "Photo file storage is unavailable in this runtime.",
    };
  }

  const directory = params.destinationUri.slice(
    0,
    params.destinationUri.lastIndexOf("/"),
  );

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.copyAsync({
    from: params.sourceUri,
    to: params.destinationUri,
  });

  return {
    localUri: params.destinationUri,
    copied: true,
    message: "Photo copied into dispute local evidence storage.",
  };
}

export async function deleteEvidencePhotoFile(localUri: string): Promise<{
  deleted: boolean;
  message: string;
}> {
  try {
    if (!FileSystem.deleteAsync) {
      return {
        deleted: false,
        message: "Photo file delete is unavailable in this runtime.",
      };
    }

    await FileSystem.deleteAsync(localUri, { idempotent: true });
    return { deleted: true, message: "Local photo file deleted." };
  } catch (error) {
    return {
      deleted: false,
      message:
        error instanceof Error
          ? error.message
          : "Local photo file delete failed.",
    };
  }
}

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/^-+|-+$/g, "")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^-+|-+$/g, "");

  return sanitized.length > 0 ? sanitized : "unknown";
}
