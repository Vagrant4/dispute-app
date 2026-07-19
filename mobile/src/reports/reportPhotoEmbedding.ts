import type { ProgressClaimSnapshot } from "./progressClaimTypes";

export type PhotoEmbeddingFileSystem = {
  EncodingType?: {
    Base64?: unknown;
  };
  readAsStringAsync?: (
    uri: string,
    options?: { encoding?: unknown },
  ) => Promise<string>;
};

export async function embedPhotoEvidenceForPrint(
  snapshot: ProgressClaimSnapshot,
  fileSystem: PhotoEmbeddingFileSystem,
): Promise<ProgressClaimSnapshot> {
  if (!fileSystem.readAsStringAsync) {
    return snapshot;
  }
  const readAsStringAsync = fileSystem.readAsStringAsync;

  const photoEvidence = await Promise.all(
    snapshot.photoEvidence.map(async (photo) => {
      if (photo.localUri.startsWith("data:image/")) {
        return {
          ...photo,
          printUri: photo.localUri,
        };
      }
      if (!canReadAsPrintableImage(photo.localUri)) {
        return photo;
      }

      try {
        const base64 = await readAsStringAsync(photo.localUri, {
          encoding: fileSystem.EncodingType?.Base64 ?? "base64",
        });
        if (!base64) {
          return photo;
        }
        return {
          ...photo,
          printUri: `data:${inferImageMimeType(photo.localUri)};base64,${base64}`,
        };
      } catch {
        return photo;
      }
    }),
  );

  return {
    ...snapshot,
    photoEvidence,
  };
}

function canReadAsPrintableImage(uri: string): boolean {
  return uri.startsWith("file:") || uri.startsWith("content:");
}

function inferImageMimeType(uri: string): string {
  const normalized = uri.toLowerCase().split("?")[0] ?? "";
  if (normalized.endsWith(".png")) {
    return "image/png";
  }
  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }
  return "image/jpeg";
}
