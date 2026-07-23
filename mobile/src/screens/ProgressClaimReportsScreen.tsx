import { useEffect, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";

import type { LocalAccount } from "../auth/localAuth";
import type {
  GeneratedDocumentRow,
  GeneratedDocumentType,
} from "../reports/generatedDocumentRepository";
import { generateAndArchiveProgressClaim } from "../reports/progressClaimReportArchive";
import { shareGeneratedDocument } from "../reports/reportSharing";
import { expoSharingAdapter } from "../reports/reportSharingExpo";
import { viewGeneratedDocument } from "../reports/reportViewing";
import type { ProgressClaimSnapshot } from "../reports/progressClaimTypes";
import { progressClaimReportContent } from "../screenContent";
import { styles } from "../styles";
import {
  fetchSubscriptionStatus,
  formatSubscriptionPrice,
  formatTrialCountdown,
  type SubscriptionEntitlement,
} from "../subscription/subscriptionClient";
import type { WorkProject } from "../work/workRepository";
import {
  deleteWebGeneratedDocumentFile,
  getLastWebExportPreview,
  getWebProgressClaimRepositories,
  saveProgressClaimCsvForWeb,
  saveProgressClaimPdfForWeb,
  viewWebGeneratedDocumentFile,
} from "../reports/webReportAdapters";

const LOCAL_USER_ID = "local-user";

type ProgressClaimReportsScreenProps = {
  account: LocalAccount;
};

export function ProgressClaimReportsScreen({ account }: ProgressClaimReportsScreenProps) {
  const [status, setStatus] = useState(progressClaimReportContent.localStorage);
  const [subscription, setSubscription] = useState<SubscriptionEntitlement | null>(
    null,
  );
  const [subscriptionStatus, setSubscriptionStatus] = useState(
    "Checking subscription status...",
  );
  const [documents, setDocuments] = useState<GeneratedDocumentRow[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [exportPreview, setExportPreview] = useState<{
    fileName: string;
    contents: string;
  } | null>(null);
  const [lastExportedReport, setLastExportedReport] = useState<{
    filePath: string;
    fileName: string;
    documentId: string;
    type: GeneratedDocumentType;
    snapshot: ProgressClaimSnapshot;
  } | null>(null);
  const [reportPreview, setReportPreview] = useState<ProgressClaimSnapshot | null>(
    null,
  );

  useEffect(() => {
    void refreshArchive();
    void refreshSubscriptionStatus();
  }, []);

  async function refreshSubscriptionStatus() {
    const result = await fetchSubscriptionStatus();
    if (!result.ok) {
      setSubscription(null);
      setSubscriptionStatus(result.message);
      return;
    }

    setSubscription(result.subscription);
    const trialCountdown = formatTrialCountdown(result.subscription);
    setSubscriptionStatus(
      trialCountdown ||
        `${result.subscription.planName} ${formatSubscriptionPrice(
          result.subscription,
        )}: ${result.subscription.message}`,
    );
  }

  async function ensureCanExport(): Promise<boolean> {
    return ensureCanExportWithRefresh(
      subscription,
      setSubscription,
      setSubscriptionStatus,
      setStatus,
    );
  }

  async function refreshArchive() {
    try {
      const repositories = await getReportRepositories();
      const [rows, projectRows] = await Promise.all([
        repositories.generatedDocuments.listRecentGeneratedDocuments({
          userId: LOCAL_USER_ID,
          limit: 10,
        }),
        repositories.work.listProjects(),
      ]);
      setDocuments(rows);
      setProjects(projectRows);
      setSelectedProjectId((current) =>
        projectRows.some((project) => project.id === current)
          ? current
          : projectRows[0]?.id ?? null,
      );
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleGenerate(
    type: GeneratedDocumentType,
    projectIdOverride?: string,
  ) {
    if (!(await ensureCanExport())) {
      return;
    }

    const projectId = projectIdOverride ?? selectedProjectId;
    if (!projectId) {
      setStatus("Create or choose a project before exporting a report.");
      return;
    }

    try {
      const repositories = await getReportRepositories();
      const selectedProject = projects.find((project) => project.id === projectId);
      setSelectedProjectId(projectId);
      setStatus(
        `Creating PDF${selectedProject?.name ? ` for ${selectedProject.name}` : ""}...`,
      );
      const result = await generateAndArchiveProgressClaim({
        type,
        userId: LOCAL_USER_ID,
        projectId,
        repositories,
        saveCsv: Platform.OS === "web" ? saveProgressClaimCsvForWeb : undefined,
        savePdf: Platform.OS === "web" ? saveProgressClaimPdfForWeb : undefined,
      });

      setStatus(
        `${result.message} Archived locally for manual export${
          selectedProject?.name ? ` for ${selectedProject.name}` : ""
        }. Tap View Report to inspect it.`,
      );
      setLastExportedReport({
        filePath: result.filePath,
        fileName: result.fileName,
        documentId: result.documentId,
        type,
        snapshot: result.snapshot,
      });
      setReportPreview(result.snapshot);
      if (Platform.OS === "web") {
        setExportPreview(getLastWebExportPreview());
      }
      await refreshArchive();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleViewReport(params: {
    filePath: string | null | undefined;
    snapshot?: ProgressClaimSnapshot | null;
    snapshotJson?: string | null;
  }) {
    const snapshot = params.snapshot ?? parseSnapshot(params.snapshotJson);
    if (snapshot) {
      setReportPreview(snapshot);
      setStatus("Report preview shown below. Use Email / Share to send the file.");
      return;
    }

    if (!params.filePath) {
      setStatus("This archived document does not have a preview or local file path.");
      return;
    }

    try {
      const result =
        Platform.OS === "web"
          ? await viewWebGeneratedDocumentFile(params.filePath)
          : await viewNativeGeneratedDocumentFile(params.filePath);
      setStatus(result.message);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleShare(document: GeneratedDocumentRow) {
    if (!(await ensureCanExport())) {
      return;
    }

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

  async function handleDownloadPdf(params: {
    filePath: string | null | undefined;
    fileName: string;
    documentType?: string;
  }) {
    if (!(await ensureCanExport())) {
      return;
    }

    if (params.documentType && params.documentType !== "progress_claim_pdf") {
      setStatus("Only PDF reports can be downloaded as PDF files.");
      return;
    }
    if (!params.filePath) {
      setStatus("This report does not have a saved PDF file path.");
      return;
    }

    try {
      const result =
        Platform.OS === "web"
          ? {
              downloaded: false,
              sourcePath: params.filePath,
              message: "Browser downloads are already handled by the browser.",
            }
          : await downloadNativePdf(params.filePath, params.fileName);
      setStatus(result.message);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleDelete(document: GeneratedDocumentRow) {
    try {
      const repositories = await getReportRepositories();
      const fileResult =
        Platform.OS === "web"
          ? await deleteWebGeneratedDocumentFile(document.local_uri)
          : await deleteNativeGeneratedDocumentFile(document.local_uri);
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
        <Text style={styles.eyebrow}>Export</Text>
        <Text style={styles.heading}>Create claim PDF</Text>
        <Text style={styles.muted}>{subscriptionStatus}</Text>
        {!subscription?.canExportReports ? (
          <Text style={styles.statusMessage}>
            Export requires an active trial or subscription for {account.email}.
          </Text>
        ) : null}
        <Text style={styles.muted}>
          Choose one project. The PDF only includes that project&apos;s time,
          locations, and photos.
        </Text>
        <View style={styles.metricGrid}>
          <View style={styles.metricTile}>
            <Text style={styles.metricValue}>{documents.length}</Text>
            <Text style={styles.metricLabel}>archived files</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricValue}>PDF</Text>
            <Text style={styles.metricLabel}>export format</Text>
          </View>
        </View>
        <Text style={styles.inputLabel}>Project to export</Text>
        {projects.length ? (
          <View style={styles.actionRow}>
            {projects.map((project) => {
              const selected = project.id === selectedProjectId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={project.id}
                  onPress={() => void handleGenerate("progress_claim_pdf", project.id)}
                  style={selected ? styles.actionButton : styles.actionButtonSecondary}
                >
                  <Text
                    style={
                      selected
                        ? styles.actionButtonText
                        : styles.actionButtonSecondaryText
                    }
                  >
                    {project.name}
                  </Text>
                  <Text
                    style={
                      selected
                        ? styles.actionButtonSubtext
                        : styles.actionButtonSecondarySubtext
                    }
                  >
                    Individual project report
                  </Text>
                  <Text
                    style={
                      selected
                        ? styles.actionButtonSubtext
                        : styles.actionButtonSecondarySubtext
                    }
                  >
                    Tap to create PDF
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.muted}>
            No project yet. Create a project before exporting.
          </Text>
        )}
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: !selectedProjectId || subscription?.canExportReports === false,
            }}
            disabled={!selectedProjectId || subscription?.canExportReports === false}
            onPress={() => void handleGenerate("progress_claim_pdf")}
            style={[
              styles.actionButton,
              (!selectedProjectId || subscription?.canExportReports === false) &&
                styles.disabledButton,
            ]}
          >
            <Text style={styles.actionButtonText}>Create PDF</Text>
            <Text style={styles.actionButtonSubtext}>Ready for claim sharing</Text>
          </Pressable>
          {lastExportedReport ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                void handleDownloadPdf({
                  filePath: lastExportedReport.filePath,
                  fileName: lastExportedReport.fileName,
                  documentType: lastExportedReport.type,
                })
              }
              style={styles.actionButtonSecondary}
            >
              <Text style={styles.actionButtonSecondaryText}>Download PDF</Text>
              <Text style={styles.actionButtonSecondarySubtext}>
                Save to a phone folder
              </Text>
            </Pressable>
          ) : null}
          {lastExportedReport ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleViewReport(lastExportedReport)}
              style={styles.actionButtonSecondary}
            >
              <Text style={styles.actionButtonSecondaryText}>View Report</Text>
              <Text style={styles.actionButtonSecondarySubtext}>
                Open the latest generated file
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Status</Text>
        <Text style={styles.statusMessage}>{status}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Files</Text>
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
                    {formatDocumentType(document.document_type)} -{" "}
                    {document.period_start ?? "No start"} to{" "}
                    {document.period_end ?? "No end"}
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  {document.document_type === "progress_claim_pdf" ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void handleDownloadPdf({
                          filePath: document.local_uri,
                          fileName: document.file_name,
                          documentType: document.document_type,
                        })
                      }
                      style={styles.statusPill}
                    >
                      <Text style={styles.statusPillText}>Download PDF</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      void handleViewReport({
                        filePath: document.local_uri,
                        snapshotJson: document.snapshot_json,
                      })
                    }
                    style={styles.statusPill}
                  >
                    <Text style={styles.statusPillText}>View Report</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void handleShare(document)}
                    style={styles.statusPill}
                  >
                  <Text style={styles.statusPillText}>Email / Share</Text>
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

      {Platform.OS === "web" && exportPreview ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Browser export preview</Text>
          <Text style={styles.muted}>{exportPreview.fileName}</Text>
          <Text style={styles.codePreview}>
            {exportPreview.contents.slice(0, 1600)}
          </Text>
        </View>
      ) : null}

      {reportPreview ? (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Report preview</Text>
          <Text style={styles.heading}>
            {reportPreview.project.name ?? "Project report"}
          </Text>
          <Text style={styles.muted}>
            {reportPreview.claimPeriod.start} to {reportPreview.claimPeriod.end}
          </Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>
                {reportPreview.totals.totalDaysWorked}
              </Text>
              <Text style={styles.metricLabel}>days</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>
                {formatMoney(
                  reportPreview.totals.totalClaimAmountCents,
                  reportPreview.rateCalculation.currency,
                )}
              </Text>
              <Text style={styles.metricLabel}>claim</Text>
            </View>
          </View>
          <Text style={styles.inputLabel}>Work log</Text>
          <View style={styles.list}>
            {reportPreview.dailyWorkLog.map((item) => (
              <View key={item.workDate} style={styles.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.rowLabel}>{item.workDate}</Text>
                  <Text style={styles.body}>{item.activity}</Text>
                  <Text style={styles.muted}>
                    Location: {formatPreviewLocations(item.locations)}
                  </Text>
                  <Text style={styles.muted}>
                    Photos: {item.photoEvidenceIds.join(", ") || "None"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.inputLabel}>Photo evidence</Text>
          {reportPreview.photoEvidence.length ? (
            <View style={styles.list}>
              {reportPreview.photoEvidence.map((photo) => (
                <View key={photo.id} style={styles.row}>
                  <Image
                    accessibilityLabel={`Photo evidence ${photo.id}`}
                    source={{ uri: photo.localUri }}
                    style={styles.reportPreviewImage}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.rowLabel}>Photo ID: {photo.id}</Text>
                    <Text style={styles.muted}>
                      Time entry: {photo.timeEntryId ?? "Not linked"}
                    </Text>
                    <Text style={styles.body}>{photo.caption ?? ""}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>No photo evidence in this project report.</Text>
          )}
        </View>
      ) : null}
    </>
  );
}

async function ensureCanExportWithRefresh(
  subscription: SubscriptionEntitlement | null,
  setSubscription: (value: SubscriptionEntitlement | null) => void,
  setSubscriptionStatus: (value: string) => void,
  setStatus: (value: string) => void,
): Promise<boolean> {
  if (subscription?.canExportReports) {
    return true;
  }

  setStatus("Checking subscription before export...");
  const result = await fetchSubscriptionStatus();
  if (!result.ok) {
    setSubscription(null);
    setSubscriptionStatus(result.message);
    setStatus(result.message);
    return false;
  }

  setSubscription(result.subscription);
  setSubscriptionStatus(
    formatTrialCountdown(result.subscription) || result.subscription.message,
  );
  if (result.subscription.canExportReports) {
    return true;
  }

  setStatus(result.subscription.message);
  return false;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Report action failed.";
}

function formatDocumentType(type: string): string {
  return type === "progress_claim_pdf" ? "PDF report" : "CSV report";
}

function formatMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function formatPreviewLocations(
  locations: Array<{ address: string; latitude: number | null; longitude: number | null }>,
): string {
  return locations
    .map((location) => {
      const coordinates =
        location.latitude != null && location.longitude != null
          ? ` (${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)})`
          : "";
      return `${location.address}${coordinates}`;
    })
    .join("; ") || "No location recorded";
}

function parseSnapshot(value: string | null | undefined): ProgressClaimSnapshot | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as ProgressClaimSnapshot;
    return parsed?.title === "Progress Claim Report" ? parsed : null;
  } catch {
    return null;
  }
}

async function getReportRepositories() {
  if (Platform.OS === "web") {
    return getWebProgressClaimRepositories();
  }

  const { getLocalRepositories } = await import("../db/repositories");
  return getLocalRepositories();
}

async function deleteNativeGeneratedDocumentFile(
  filePath: string | null | undefined,
) {
  const { deleteGeneratedDocumentFile } = await import(
    "../reports/generatedDocumentFiles"
  );
  return deleteGeneratedDocumentFile(filePath);
}

async function viewNativeGeneratedDocumentFile(filePath: string) {
  const { reactNativeReportViewAdapter } = await import(
    "../reports/reportViewingReactNative"
  );
  return viewGeneratedDocument({
    filePath,
    viewer: reactNativeReportViewAdapter,
  });
}

async function downloadNativePdf(filePath: string, fileName: string) {
  const { downloadGeneratedPdfWithExpo } = await import(
    "../reports/reportDownloadExpo"
  );
  return downloadGeneratedPdfWithExpo({ filePath, fileName });
}
