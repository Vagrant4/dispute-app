import * as FileSystem from "expo-file-system/legacy";

export type GeneratedDocumentFormat = "pdf" | "csv";

export class DurableReportStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DurableReportStorageError";
  }
}

export function buildGeneratedDocumentPath(params: {
  userId: string;
  projectId?: string | null;
  documentId: string;
  format: GeneratedDocumentFormat;
  baseDirectory?: string | null;
}): string {
  const baseDirectory = getDurableReportBaseDirectory(params.baseDirectory);
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

export function getDurableReportBaseDirectory(
  baseDirectory = FileSystem.documentDirectory,
): string {
  if (!baseDirectory || baseDirectory.trim().length === 0) {
    throw new DurableReportStorageError(
      "dispute app-owned local report storage is unavailable in this runtime, so the report was not archived.",
    );
  }

  return baseDirectory;
}

export async function writeGeneratedDocumentText(params: {
  filePath: string;
  contents: string;
}): Promise<{ filePath: string; written: boolean; message: string }> {
  const fileSystem = getDurableWriteFileSystem("write generated report files");

  const directory = params.filePath.slice(0, params.filePath.lastIndexOf("/"));
  await fileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await fileSystem.writeAsStringAsync(params.filePath, params.contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await assertDurableFileExists(params.filePath, fileSystem);

  return {
    filePath: params.filePath,
    written: true,
    message: "Generated document saved in local app storage.",
  };
}

export async function copyGeneratedDocumentFile(params: {
  sourceUri: string;
  destinationUri: string;
}): Promise<{ filePath: string; copied: boolean; message: string }> {
  const fileSystem = getDurableCopyFileSystem("copy generated report files");

  const directory = params.destinationUri.slice(
    0,
    params.destinationUri.lastIndexOf("/"),
  );
  await fileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await fileSystem.copyAsync({
    from: params.sourceUri,
    to: params.destinationUri,
  });
  await assertDurableFileExists(params.destinationUri, fileSystem);

  return {
    filePath: params.destinationUri,
    copied: true,
    message: "Generated document copied into local app storage.",
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

function getDurableWriteFileSystem(action: string): {
  getInfoAsync: NonNullable<typeof FileSystem.getInfoAsync>;
  makeDirectoryAsync: NonNullable<typeof FileSystem.makeDirectoryAsync>;
  writeAsStringAsync: NonNullable<typeof FileSystem.writeAsStringAsync>;
} {
  if (
    !FileSystem.makeDirectoryAsync ||
    !FileSystem.getInfoAsync ||
    !FileSystem.writeAsStringAsync
  ) {
    throw new DurableReportStorageError(
      `Durable report storage is unavailable in this runtime, so dispute cannot ${action} or archive the report.`,
    );
  }

  return {
    getInfoAsync: FileSystem.getInfoAsync,
    makeDirectoryAsync: FileSystem.makeDirectoryAsync,
    writeAsStringAsync: FileSystem.writeAsStringAsync,
  };
}

function getDurableCopyFileSystem(action: string): {
  copyAsync: NonNullable<typeof FileSystem.copyAsync>;
  getInfoAsync: NonNullable<typeof FileSystem.getInfoAsync>;
  makeDirectoryAsync: NonNullable<typeof FileSystem.makeDirectoryAsync>;
} {
  if (
    !FileSystem.makeDirectoryAsync ||
    !FileSystem.getInfoAsync ||
    !FileSystem.copyAsync
  ) {
    throw new DurableReportStorageError(
      `Durable report storage is unavailable in this runtime, so dispute cannot ${action} or archive the report.`,
    );
  }

  return {
    copyAsync: FileSystem.copyAsync,
    getInfoAsync: FileSystem.getInfoAsync,
    makeDirectoryAsync: FileSystem.makeDirectoryAsync,
  };
}

async function assertDurableFileExists(
  filePath: string,
  fileSystem: Pick<typeof FileSystem, "getInfoAsync">,
): Promise<void> {
  const info = await fileSystem.getInfoAsync(filePath);

  if (!info.exists) {
    throw new DurableReportStorageError(
      "Durable report storage verification failed. The generated file was not found in app-owned report storage, so it was not archived.",
    );
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
