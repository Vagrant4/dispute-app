export type ReportDownloadFileSystem = {
  EncodingType?: {
    Base64?: unknown;
  };
  readAsStringAsync?: (
    fileUri: string,
    options?: { encoding?: unknown },
  ) => Promise<string>;
  StorageAccessFramework?: {
    requestDirectoryPermissionsAsync?: (
      initialFileUrl?: string | null,
    ) => Promise<{ granted: boolean; directoryUri?: string | null }>;
    createFileAsync?: (
      parentUri: string,
      fileName: string,
      mimeType: string,
    ) => Promise<string>;
    writeAsStringAsync?: (
      fileUri: string,
      contents: string,
      options?: { encoding?: unknown },
    ) => Promise<void>;
  };
};

export type DownloadGeneratedPdfResult = {
  downloaded: boolean;
  sourcePath: string;
  destinationUri?: string;
  message: string;
};

export async function downloadGeneratedPdfToUserFolder(params: {
  filePath: string;
  fileName: string;
  fileSystem: ReportDownloadFileSystem;
}): Promise<DownloadGeneratedPdfResult> {
  const storage = params.fileSystem.StorageAccessFramework;
  if (
    !params.fileSystem.readAsStringAsync ||
    !storage?.requestDirectoryPermissionsAsync ||
    !storage.createFileAsync ||
    !storage.writeAsStringAsync
  ) {
    return {
      downloaded: false,
      sourcePath: params.filePath,
      message:
        "Download PDF is unavailable in this runtime. Use Email / Share as a fallback.",
    };
  }

  const permission = await storage.requestDirectoryPermissionsAsync();
  if (!permission.granted || !permission.directoryUri) {
    return {
      downloaded: false,
      sourcePath: params.filePath,
      message: "Download cancelled. Choose a folder to save the PDF.",
    };
  }

  const base64 = await params.fileSystem.readAsStringAsync(params.filePath, {
    encoding: params.fileSystem.EncodingType?.Base64 ?? "base64",
  });
  const destinationUri = await storage.createFileAsync(
    permission.directoryUri,
    sanitizePdfFileName(params.fileName),
    "application/pdf",
  );
  await storage.writeAsStringAsync(destinationUri, base64, {
    encoding: params.fileSystem.EncodingType?.Base64 ?? "base64",
  });

  return {
    downloaded: true,
    sourcePath: params.filePath,
    destinationUri,
    message: "PDF downloaded to the folder you selected on this phone.",
  };
}

export function sanitizePdfFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.pdf$/i, "");
  const cleaned = withoutExtension
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || `dispute-report-${Date.now()}`;
}
