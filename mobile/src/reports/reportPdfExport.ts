import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";

import { buildGeneratedDocumentPath } from "./generatedDocumentFiles";
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

  if (!FileSystem.copyAsync || !FileSystem.makeDirectoryAsync) {
    return {
      filePath: result.uri,
      message:
        "PDF generated locally from ClaimProof SG report HTML. Runtime file copy is unavailable, so the print file URI is archived.",
    };
  }

  const directory = filePath.slice(0, filePath.lastIndexOf("/"));
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.copyAsync({
    from: result.uri,
    to: filePath,
  });

  return {
    filePath,
    message: "PDF generated locally and saved in app-owned report storage.",
  };
}
