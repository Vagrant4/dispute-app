import { createGeneratedDocumentId } from "./generatedDocumentArchiveService";
import type {
  GeneratedDocumentRow,
  InsertGeneratedDocumentParams,
} from "./generatedDocumentRepository";
import { buildProgressClaimCsv } from "./progressClaimCsv";
import { buildProgressClaimHtml } from "./progressClaimHtml";
import type { ProgressClaimSnapshot } from "./progressClaimTypes";
import { buildWebWorkProgressClaimSnapshot, webWorkStore } from "../work/webWorkStore";

const STORAGE_KEY = "claimproof-sg-web-generated-documents";
const EXPORT_CONTENT_KEY_PREFIX = "claimproof-sg-web-export:";
let lastWebExportPreview: { fileName: string; contents: string } | null = null;

export function getWebProgressClaimRepositories() {
  return {
    progressClaims: {
      buildLatestProgressClaimSnapshot: async (params: {
        userId: string;
        projectId?: string;
      }) => buildWebWorkProgressClaimSnapshot({ projectId: params.projectId }),
    },
    generatedDocuments: {
      insertGeneratedDocument: async (params: InsertGeneratedDocumentParams) => {
        const rows = readRows();
        rows.unshift(toGeneratedDocumentRow(params));
        writeRows(rows);
      },
      listRecentGeneratedDocuments: async (params: {
        userId: string;
        limit?: number;
      }) =>
        readRows()
          .filter((row) => row.user_id === params.userId)
          .slice(0, Math.max(1, Math.min(params.limit ?? 20, 100))),
      deleteGeneratedDocument: async (params: { id: string; userId: string }) => {
        writeRows(
          readRows().filter(
            (row) => row.id !== params.id || row.user_id !== params.userId,
          ),
        );
      },
    },
    work: webWorkStore,
  };
}

export async function saveProgressClaimCsvForWeb(params: {
  snapshot: ProgressClaimSnapshot;
  userId: string;
  documentId: string;
}): Promise<{ filePath: string; message: string }> {
  const fileName = buildFileName(params, "csv");
  const csv = buildProgressClaimCsv(params.snapshot);
  downloadTextFile(fileName, csv, "text/csv;charset=utf-8");
  lastWebExportPreview = { fileName, contents: csv };
  return {
    filePath: `browser-download://${fileName}`,
    message: "CSV generated and downloaded by the browser.",
  };
}

export async function saveProgressClaimPdfForWeb(params: {
  snapshot: ProgressClaimSnapshot;
  userId: string;
  documentId: string;
}): Promise<{ filePath: string; message: string }> {
  const fileName = buildFileName(params, "html");
  const html = buildProgressClaimHtml(params.snapshot);
  downloadTextFile(fileName, html, "text/html;charset=utf-8");
  lastWebExportPreview = { fileName, contents: html };
  return {
    filePath: `browser-download://${fileName}`,
    message:
      "Printable report HTML generated and downloaded by the browser. Native mobile builds generate PDF files on device.",
  };
}

export function getLastWebExportPreview():
  | { fileName: string; contents: string }
  | null {
  return lastWebExportPreview;
}

export async function viewWebGeneratedDocumentFile(
  filePath: string | null | undefined,
): Promise<{ opened: boolean; filePath: string; message: string }> {
  const safeFilePath = filePath ?? "";
  if (!safeFilePath.startsWith("browser-download://")) {
    return {
      opened: false,
      filePath: safeFilePath,
      message: "Browser report preview is unavailable for this file.",
    };
  }

  const fileName = safeFilePath.replace("browser-download://", "");
  const contents =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(`${EXPORT_CONTENT_KEY_PREFIX}${fileName}`)
      : null;
  if (!contents || typeof window === "undefined") {
    return {
      opened: false,
      filePath: safeFilePath,
      message: "Browser report preview is unavailable. Check your downloads folder.",
    };
  }

  const mimeType = fileName.endsWith(".csv")
    ? "text/csv;charset=utf-8"
    : "text/html;charset=utf-8";
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return {
    opened: true,
    filePath: safeFilePath,
    message: "Report opened in a new browser tab.",
  };
}

export async function deleteWebGeneratedDocumentFile(
  filePath: string | null | undefined,
): Promise<{ deleted: boolean; message: string }> {
  return {
    deleted: Boolean(filePath),
    message: "Browser-downloaded files are managed by the browser downloads folder.",
  };
}

function buildFileName(
  params: { snapshot: ProgressClaimSnapshot; documentId: string },
  format: "csv" | "html",
): string {
  const projectId = params.snapshot.project.id ?? "no-project";
  return `${sanitize(projectId)}-${sanitize(params.documentId)}.${format}`;
}

function downloadTextFile(fileName: string, contents: string, mimeType: string) {
  if (typeof document === "undefined") {
    throw new Error("Browser download is unavailable outside web runtime.");
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(`${EXPORT_CONTENT_KEY_PREFIX}${fileName}`, contents);
  }

  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readRows(): GeneratedDocumentRow[] {
  if (typeof localStorage === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GeneratedDocumentRow[]) : [];
  } catch {
    return [];
  }
}

function writeRows(rows: GeneratedDocumentRow[]) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }
}

function toGeneratedDocumentRow(
  params: InsertGeneratedDocumentParams,
): GeneratedDocumentRow {
  const now = new Date().toISOString();
  return {
    id: params.id || createGeneratedDocumentId("web-document"),
    user_id: params.userId,
    project_id: params.projectId ?? null,
    document_type: params.type,
    file_name: params.fileName,
    local_uri: params.filePath ?? null,
    file_hash: params.hash ?? null,
    period_start: params.periodStart ?? null,
    period_end: params.periodEnd ?? null,
    metadata_json: params.metadata ? JSON.stringify(params.metadata) : null,
    snapshot_json:
      params.snapshot === undefined ? null : JSON.stringify(params.snapshot),
    status: params.status ?? "finalized",
    lock_hash: params.hash ?? null,
    locked_at: now,
    created_at: now,
    updated_at: now,
  };
}

function sanitize(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
