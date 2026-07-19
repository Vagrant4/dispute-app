import {
  buildGeneratedDocumentArchiveInput,
  createGeneratedDocumentId,
} from "./generatedDocumentArchiveService";
import type {
  GeneratedDocumentType,
  InsertGeneratedDocumentParams,
} from "./generatedDocumentRepository";
import type { ProgressClaimSnapshot } from "./progressClaimTypes";
import { saveProgressClaimCsv } from "./reportCsvExport";
import { saveProgressClaimPdf } from "./reportPdfExport";

export type ProgressClaimReportArchiveRepositories = {
  progressClaims: {
    buildLatestProgressClaimSnapshot: (params: {
      userId: string;
      projectId?: string;
    }) => Promise<ProgressClaimSnapshot>;
  };
  generatedDocuments: {
    insertGeneratedDocument: (
      params: InsertGeneratedDocumentParams,
    ) => Promise<void>;
  };
};

export type GenerateAndArchiveProgressClaimResult = {
  documentId: string;
  filePath: string;
  fileName: string;
  snapshot: ProgressClaimSnapshot;
  message: string;
};

export async function generateAndArchiveProgressClaim(params: {
  type: GeneratedDocumentType;
  userId: string;
  projectId?: string;
  repositories: ProgressClaimReportArchiveRepositories;
  createDocumentId?: (prefix?: string) => string;
  savePdf?: typeof saveProgressClaimPdf;
  saveCsv?: typeof saveProgressClaimCsv;
  buildArchiveInput?: typeof buildGeneratedDocumentArchiveInput;
}): Promise<GenerateAndArchiveProgressClaimResult> {
  const snapshot =
    await params.repositories.progressClaims.buildLatestProgressClaimSnapshot({
      userId: params.userId,
      projectId: params.projectId,
    });
  const documentId = (params.createDocumentId ?? createGeneratedDocumentId)(
    params.type === "progress_claim_pdf" ? "claim-pdf" : "claim-csv",
  );
  const exportResult =
    params.type === "progress_claim_pdf"
      ? await (params.savePdf ?? saveProgressClaimPdf)({
          snapshot,
          userId: params.userId,
          documentId,
        })
      : await (params.saveCsv ?? saveProgressClaimCsv)({
          snapshot,
          userId: params.userId,
          documentId,
        });
  const archiveInput = await (
    params.buildArchiveInput ?? buildGeneratedDocumentArchiveInput
  )({
    id: documentId,
    userId: params.userId,
    type: params.type,
    filePath: exportResult.filePath,
    snapshot,
    metadata: {
      format: params.type === "progress_claim_pdf" ? "pdf" : "csv",
      source: "mobile-local-report-screen",
    },
  });

  await params.repositories.generatedDocuments.insertGeneratedDocument(archiveInput);

  return {
    documentId,
    filePath: exportResult.filePath,
    fileName: archiveInput.fileName,
    snapshot,
    message: exportResult.message,
  };
}
