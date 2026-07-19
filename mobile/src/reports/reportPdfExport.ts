import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";

import {
  buildGeneratedDocumentPath,
  copyGeneratedDocumentFile,
} from "./generatedDocumentFiles";
import { buildProgressClaimHtml } from "./progressClaimHtml";
import type { ProgressClaimSnapshot } from "./progressClaimTypes";
import { embedPhotoEvidenceForPrint } from "./reportPhotoEmbedding";

export async function saveProgressClaimPdf(params: {
  snapshot: ProgressClaimSnapshot;
  userId: string;
  documentId: string;
}): Promise<{ filePath: string; message: string }> {
  const printableSnapshot = await embedPhotoEvidenceForPrint(
    params.snapshot,
    {
      EncodingType: FileSystem.EncodingType,
      readAsStringAsync: (uri, options) =>
        FileSystem.readAsStringAsync(uri, {
          encoding: options?.encoding as FileSystem.EncodingType | undefined,
        }),
    },
  );
  const html = buildProgressClaimHtml(printableSnapshot);
  const result = await Print.printToFileAsync({
    html,
    base64: false,
  });
  const filePath = buildGeneratedDocumentPath({
    userId: params.userId,
    projectId: params.snapshot.project.id,
    documentId: params.documentId,
    format: "pdf",
  });
  const copyResult = await copyGeneratedDocumentFile({
    sourceUri: result.uri,
    destinationUri: filePath,
  });

  return {
    filePath: copyResult.filePath,
    message: "PDF generated locally and saved in app-owned report storage.",
  };
}
