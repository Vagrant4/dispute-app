import * as Print from "expo-print";

import {
  buildGeneratedDocumentPath,
  copyGeneratedDocumentFile,
} from "./generatedDocumentFiles";
import { buildProgressClaimHtml } from "./progressClaimHtml";
import type { ProgressClaimSnapshot } from "./progressClaimTypes";

export async function saveProgressClaimPdf(params: {
  snapshot: ProgressClaimSnapshot;
  userId: string;
  documentId: string;
}): Promise<{ filePath: string; message: string }> {
  const html = buildProgressClaimHtml(params.snapshot);
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
