import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { getLocalRepositories } from "../db/repositories";
import {
  buildGeneratedDocumentArchiveInput,
  createGeneratedDocumentId,
} from "../reports/generatedDocumentArchiveService";
import {
  deleteGeneratedDocumentFile,
} from "../reports/generatedDocumentFiles";
import type {
  GeneratedDocumentRow,
  GeneratedDocumentType,
} from "../reports/generatedDocumentRepository";
import { saveProgressClaimCsv } from "../reports/reportCsvExport";
import { saveProgressClaimPdf } from "../reports/reportPdfExport";
import { shareGeneratedDocument } from "../reports/reportSharing";
import { expoSharingAdapter } from "../reports/reportSharingExpo";
import { progressClaimReportContent } from "../screenContent";
import { styles } from "../styles";

const LOCAL_USER_ID = "local-user";

export function ProgressClaimReportsScreen() {
  const [status, setStatus] = useState(progressClaimReportContent.localStorage);
  const [documents, setDocuments] = useState<GeneratedDocumentRow[]>([]);

  useEffect(() => {
    void refreshArchive();
  }, []);

  async function refreshArchive() {
    try {
      const repositories = await getLocalRepositories();
      const rows = await repositories.generatedDocuments.listRecentGeneratedDocuments({
        userId: LOCAL_USER_ID,
        limit: 10,
      });
      setDocuments(rows);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleGenerate(type: GeneratedDocumentType) {
    try {
      const repositories = await getLocalRepositories();
      const snapshot = await repositories.progressClaims.buildLatestProgressClaimSnapshot({
        userId: LOCAL_USER_ID,
      });
      const documentId = createGeneratedDocumentId(
        type === "progress_claim_pdf" ? "claim-pdf" : "claim-csv",
      );
      const exportResult =
        type === "progress_claim_pdf"
          ? await saveProgressClaimPdf({
              snapshot,
              userId: LOCAL_USER_ID,
              documentId,
            })
          : await saveProgressClaimCsv({
              snapshot,
              userId: LOCAL_USER_ID,
              documentId,
            });
      const archiveInput = await buildGeneratedDocumentArchiveInput({
        id: documentId,
        userId: LOCAL_USER_ID,
        type,
        filePath: exportResult.filePath,
        snapshot,
        metadata: {
          format: type === "progress_claim_pdf" ? "pdf" : "csv",
          source: "mobile-local-report-screen",
        },
      });

      await repositories.generatedDocuments.insertGeneratedDocument(archiveInput);
      setStatus(`${exportResult.message} Archived locally for manual export.`);
      await refreshArchive();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleShare(document: GeneratedDocumentRow) {
    if (!document.local_uri) {
      setStatus("This archived document does not have a local file path.");
      return;
    }

    try {
      const result = await shareGeneratedDocument({
        filePath: document.local_uri,
        mimeType:
          document.document_type === "progress_claim_pdf"
            ? "application/pdf"
            : "text/csv",
        sharing: expoSharingAdapter,
      });
      setStatus(result.message);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleDelete(document: GeneratedDocumentRow) {
    try {
      const repositories = await getLocalRepositories();
      const fileResult = await deleteGeneratedDocumentFile(document.local_uri);
      await repositories.generatedDocuments.deleteGeneratedDocument({
        id: document.id,
        userId: LOCAL_USER_ID,
      });
      setStatus(`Archive row deleted. ${fileResult.message}`);
      await refreshArchive();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Progress claim</Text>
        <Text style={styles.heading}>{progressClaimReportContent.heading}</Text>
        <Text style={styles.body}>{progressClaimReportContent.body}</Text>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleGenerate("progress_claim_pdf")}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>Generate PDF</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleGenerate("progress_claim_csv")}
            style={styles.actionButtonSecondary}
          >
            <Text style={styles.actionButtonSecondaryText}>Generate CSV</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, styles.warningCard]}>
        <Text style={styles.heading}>Local files</Text>
        <Text style={styles.body}>{progressClaimReportContent.localStorage}</Text>
        <Text style={styles.muted}>{progressClaimReportContent.noUpload}</Text>
        <Text style={styles.muted}>{status}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Generated document archive</Text>
        {documents.length === 0 ? (
          <Text style={styles.muted}>
            No generated reports are archived on this device yet.
          </Text>
        ) : (
          <View style={styles.list}>
            {documents.map((document) => (
              <View key={document.id} style={styles.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.rowLabel}>{document.file_name}</Text>
                  <Text style={styles.muted}>
                    {document.document_type} · {document.period_start ?? "No start"} to{" "}
                    {document.period_end ?? "No end"}
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void handleShare(document)}
                    style={styles.statusPill}
                  >
                    <Text style={styles.statusPillText}>Share</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void handleDelete(document)}
                    style={styles.statusPill}
                  >
                    <Text style={styles.statusPillText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Report action failed.";
}
