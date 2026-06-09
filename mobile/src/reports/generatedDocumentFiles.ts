import * as FileSystem from "expo-file-system/legacy";

export type GeneratedDocumentFormat = "pdf" | "csv";

export function buildGeneratedDocumentPath(params: {
  userId: string;
  projectId?: string | null;
  documentId: string;
  format: GeneratedDocumentFormat;
  baseDirectory?: string | null;
}): string {
  const baseDirectory =
    params.baseDirectory ?? FileSystem.documentDirectory ?? "file:///";
  const normalizedBase = baseDirectory.endsWith("/")
    ? baseDirectory
    : `${baseDirectory}/`;

  return [
    normalizedBase.replace(/\/+$/, ""),
    "generated-documents",
    sanitizePathSegment(params.userId),
    sanitizePathSegment(params.projectId ?? "no-project"),
    `${sanitizePathSegment(params.documentId)}.${params.format}`,
  ].join("/");
}

export async function writeGeneratedDocumentText(params: {
  filePath: string;
  contents: string;
}): Promise<{ filePath: string; written: boolean; message: string }> {
  if (!FileSystem.writeAsStringAsync || !FileSystem.makeDirectoryAsync) {
    return {
      filePath: params.filePath,
      written: false,
      message: "Generated document file writing is unavailable in this runtime.",
    };
  }

  const directory = params.filePath.slice(0, params.filePath.lastIndexOf("/"));
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.writeAsStringAsync(params.filePath, params.contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return {
    filePath: params.filePath,
    written: true,
    message: "Generated document saved in local app storage.",
  };
}

export async function deleteGeneratedDocumentFile(
  filePath: string | null | undefined,
): Promise<{ deleted: boolean; message: string }> {
  if (!filePath) {
    return { deleted: false, message: "Generated document has no local file path." };
  }

  try {
    if (!FileSystem.deleteAsync) {
      return {
        deleted: false,
        message: "Generated document file delete is unavailable in this runtime.",
      };
    }

    await FileSystem.deleteAsync(filePath, { idempotent: true });
    return { deleted: true, message: "Generated document file deleted." };
  } catch (error) {
    return {
      deleted: false,
      message:
        error instanceof Error
          ? error.message
          : "Generated document file delete failed.",
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
