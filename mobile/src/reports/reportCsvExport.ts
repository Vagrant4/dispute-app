import { buildGeneratedDocumentPath, writeGeneratedDocumentText } from "./generatedDocumentFiles";
import { buildProgressClaimCsv } from "./progressClaimCsv";
import type { ProgressClaimSnapshot } from "./progressClaimTypes";

export async function saveProgressClaimCsv(params: {
  snapshot: ProgressClaimSnapshot;
  userId: string;
  documentId: string;
}): Promise<{ filePath: string; message: string }> {
  const filePath = buildGeneratedDocumentPath({
    userId: params.userId,
    projectId: params.snapshot.project.id,
    documentId: params.documentId,
    format: "csv",
  });
  const writeResult = await writeGeneratedDocumentText({
    filePath,
    contents: buildProgressClaimCsv(params.snapshot),
  });

  return {
    filePath,
    message: writeResult.message,
  };
}
