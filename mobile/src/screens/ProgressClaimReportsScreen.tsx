import type { ReactNode } from "react";
import { ProjectPayCard } from "./ProjectPayCard";
import { loadWorkHours, saveWorkHours, calculateNormalHours } from "../work/workHoursSettings";
import { needsPayStep, currentWeekStart } from "../work/projectScreenStore";
import type { AppSettings } from "../db/settingsValidation";
import { parseSgdHourlyRateCents } from "../work/projectRates";
import { buildProjectWeekReport } from "../reports/projectWeekReport";
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
import { styles, type, space, radius } from "../styles";
import {
  fetchSubscriptionStatus,
  formatTrialCountdown,
  canExportProgressClaim,
  type SubscriptionEntitlement,
} from "../subscription/subscriptionClient";
import type { WorkProject } from "../work/workRepository";
import { useSubscriptionAccess } from "../subscription/useSubscriptionAccess";
import { disputePackLockContent, getDisputePackExportAccess } from "../subscription/recordAccess";
import {
  deleteWebGeneratedDocumentFile,
  getLastWebExportPreview,
  getWebProgressClaimRepositories,
  saveProgressClaimCsvForWeb,
  saveProgressClaimPdfForWeb,
  viewWebGeneratedDocumentFile,
} from "../reports/webReportAdapters";

type ProgressClaimReportsScreenProps = {
  account: LocalAccount;
  projectId?: string;
  paySetupRequest?: number;
  lockDetailsExpanded?: boolean;
  renderActions?: (actions: { share: () => void; preview: () => void; csv: () => void; locked: boolean }) => ReactNode;
  onPaySaved?: () => void;

  onCreateAccount: () => void;
  onOpenPlanBilling?: () => void;
};

export function ProgressClaimReportsScreen({ account, onCreateAccount, onOpenPlanBilling, projectId: detailProjectId, paySetupRequest, renderActions, lockDetailsExpanded = false, onPaySaved }: ProgressClaimReportsScreenProps) {
  const access = useSubscriptionAccess(account);
  const userId = account.id ?? account.email.trim().toLowerCase();
  const [status, setStatus] = useState(progressClaimReportContent.localStorage);
  const [subscription, setSubscription] = useState<SubscriptionEntitlement | null>(
    null,
  );
  const [subscriptionStatus, setSubscriptionStatus] = useState(
    "Checking subscription status...",
  );
  const [documents, setDocuments] = useState<GeneratedDocumentRow[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(detailProjectId ?? null);
  const [exportPreview, setExportPreview] = useState<{
    fileName: string;
    contents: string;
  } | null>(null);
  const [reportPreview, setReportPreview] = useState<ProgressClaimSnapshot | null>(
    null,
  );
  const [payStep, setPayStep] = useState<{ settings: AppSettings; name: string; action: "share" | "preview" | "save" } | null>(null);
  useEffect(() => {
    if (!paySetupRequest) return;
    void loadWorkHours(userId).then((preferences) => setPayStep({ settings: preferences.settings, name: (!account.isGuest && account.name) || preferences.reportName, action: "save" })).catch((error) => setStatus(getErrorMessage(error)));
  }, [paySetupRequest]);
  async function preparePay(action: "share" | "preview") {
    if (!selectedProjectId) return false;
    const preferences = await loadWorkHours(userId);
    const project = projects.find((item) => item.id === selectedProjectId);
    if (project && needsPayStep({ hourlyRateCents: project.hourlyRateCents, hasWorkHours: preferences.hasWorkHours })) {
      setPayStep({ settings: preferences.settings, name: account.isGuest ? "" : account.name || preferences.reportName, action });
      return false;
    }
    return true;
  }
  async function savePay(name: string, rate: string, settings: AppSettings) {
    if (!selectedProjectId || !payStep) return;
    const hourlyRateCents = parseSgdHourlyRateCents(rate);
    if (hourlyRateCents <= 0) throw new Error("Enter an hourly rate above zero.");
    const repositories = await getReportRepositories(userId);
    // Read the current project so saving pay cannot undo a rename in detail.
    const project = (await repositories.work.listProjects(userId)).find((item) => item.id === selectedProjectId);
    if (!project) throw new Error("Project not found for this account.");
    const dailyHours = calculateNormalHours(settings.normalWorkStartTime, settings.normalWorkEndTime);
    await saveWorkHours(userId, {
      currency: settings.currency,
      rateBasis: settings.rateBasis,
      baseRateCents: settings.baseRateCents,
      normalWorkStartTime: settings.normalWorkStartTime,
      normalWorkEndTime: settings.normalWorkEndTime,
      dailyHours,
      weeklyHours: Math.max(settings.weeklyHours, dailyHours),
      overtimeMultiplier: settings.overtimeMultiplier,
      offDayMultiplier: settings.offDayMultiplier,
      holidayMultiplier: settings.holidayMultiplier,
    }, name);
    await repositories.work.updateProject({
      userId, projectId: project.id, name: project.name,
      description: project.description, hourlyRateCents,
    });
    const action = payStep.action;
    setPayStep(null);
    await refreshArchive();
    onPaySaved?.();
    if (action === "share") await handleShareDisputePack();
    else if (action === "preview") await handlePreview();
  }
  async function reportRepositories() {
    const repositories = await getReportRepositories(userId);
    return { ...repositories, progressClaims: { buildLatestProgressClaimSnapshot: async (params: { userId: string; projectId?: string }) => {
      const preferences = await loadWorkHours(userId);
      const entries = await repositories.work.listProjectEntries(userId, params.projectId!);
      const snapshot = await repositories.progressClaims.buildLatestProgressClaimSnapshot(params);
      return buildProjectWeekReport({
        weekStart: currentWeekStart(),
        accountName: account.isGuest ? undefined : account.name,
        reportName: preferences.reportName,
        input: {
          generatedAt: new Date().toISOString(),
          client: snapshot.client,
          project: snapshot.project,
          timeEntries: entries,
          photoEvidence: snapshot.photoEvidence,
          pay: {
            ...snapshot.rateCalculation,
            ...preferences.settings,
            hourlyRateCents: snapshot.project.hourlyRateCents,
            dailyNormalMinutes: preferences.settings.dailyHours * 60,
          },
        },
      });
    } } };
  }
  const exportAccess = getDisputePackExportAccess({
    isGuest: account.isGuest === true,
    entitlement: account.isGuest ? access.subscription : subscription,
  });
  const exportLocked = !exportAccess.canExport;

  useEffect(() => {
    void refreshArchive();
    void refreshSubscriptionStatus();
  }, []);

  useEffect(() => {
    if (account.isGuest && access.subscription) {
      setSubscription(access.subscription);
      setSubscriptionStatus(access.message);
    }
  }, [account.isGuest, access.message, access.subscription]);

  async function refreshSubscriptionStatus() {
    if (account.isGuest) {
      setSubscription(access.subscription);
      setSubscriptionStatus(access.message);
      return;
    }
    const result = await fetchSubscriptionStatus(account.id);
    if (!result.ok) {
      setSubscription(null);
      setSubscriptionStatus(result.message);
      return;
    }

    setSubscription(result.subscription);
    const trialCountdown = formatTrialCountdown(result.subscription);
    setSubscriptionStatus(
      trialCountdown ||
        `${result.subscription.planName}: ${result.subscription.message}`,
    );
  }

  async function ensureCanExport(): Promise<boolean> {
    if (account.isGuest) {
      // Guests (trial or expired) never download, share or open pack files.
      setSubscription(access.subscription);
      setStatus(disputePackLockContent.lockedStatus);
      return false;
    }
    return ensureCanExportWithRefresh(
      subscription,
      account.id,
      setSubscription,
      setSubscriptionStatus,
      setStatus,
    );
  }

  async function refreshArchive() {
    try {
      const repositories = await getReportRepositories(userId);
      const [rows, projectRows, home] = await Promise.all([
        repositories.generatedDocuments.listRecentGeneratedDocuments({
          userId,
          limit: 10,
          projectId: detailProjectId,
        }),
        repositories.work.listProjects(userId),
        repositories.work.getHomeState(userId),
      ]);
      setDocuments(detailProjectId ? rows.filter((row) => row.project_id === detailProjectId) : rows);
      setProjects(projectRows);
      setSelectedProjectId((current) => detailProjectId ?? (
        projectRows.some((project) => project.id === current)
          ? current
          : home.recentEntries[0]?.projectId ?? projectRows[0]?.id ?? null),
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
      const repositories = await reportRepositories();
      const selectedProject = projects.find((project) => project.id === projectId);
      const formatLabel = type === "progress_claim_csv" ? "CSV" : "PDF";
      setSelectedProjectId(projectId);
      setStatus(
        `Creating ${formatLabel}${selectedProject?.name ? ` for ${selectedProject.name}` : ""}...`,
      );
      const result = await generateAndArchiveProgressClaim({
        type,
        userId,
        projectId,
        repositories,
        saveCsv: Platform.OS === "web" ? saveProgressClaimCsvForWeb : undefined,
        savePdf: Platform.OS === "web" ? saveProgressClaimPdfForWeb : undefined,
      });

      setStatus("Report ready.");
      setReportPreview(result.snapshot);
      if (Platform.OS === "web") {
        setExportPreview(getLastWebExportPreview());
      }
      await refreshArchive();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handlePreview(projectIdOverride?: string) {
    const projectId = projectIdOverride ?? selectedProjectId;
    if (!projectId) {
      setStatus("Create or choose a project before previewing a report.");
      return;
    }
    try {
      if (!(await preparePay("preview"))) return;
      const repositories = await reportRepositories();
      setSelectedProjectId(projectId);
      const snapshot = await repositories.progressClaims.buildLatestProgressClaimSnapshot({ userId, projectId });
      setReportPreview(snapshot);
      setStatus(
        exportLocked
          ? `Report preview shown below. ${disputePackLockContent.body}`
          : "Report preview shown below. Use Share dispute pack to send the file.",
      );
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleShareDisputePack() {
    if (!(await ensureCanExport()) || !selectedProjectId) return;
    try {
      if (!(await preparePay("share"))) return;
      const repositories = await reportRepositories();
      const result = await generateAndArchiveProgressClaim({
        type: "progress_claim_pdf", userId, projectId: selectedProjectId, repositories,
        savePdf: Platform.OS === "web" ? saveProgressClaimPdfForWeb : undefined,
      });
      await refreshArchive();
      if (Platform.OS === "web") {
        setStatus("Report ready.");
        return;
      }
      await shareGeneratedDocument({ filePath: result.filePath, mimeType: "application/pdf", sharing: expoSharingAdapter });
      setStatus("Report ready.");
    } catch (error) { setStatus(getErrorMessage(error)); }
  }

  async function handleViewReport(params: {
    filePath: string | null | undefined;
    snapshot?: ProgressClaimSnapshot | null;
    snapshotJson?: string | null;
  }) {
    const snapshot = params.snapshot ?? parseSnapshot(params.snapshotJson);
    if (snapshot) {
      setReportPreview(snapshot);
      setStatus(
        exportLocked
          ? `Report preview shown below. ${disputePackLockContent.body}`
          : "Report preview shown below. Use Share to send the file.",
      );
      return;
    }

    if (!params.filePath) {
      setStatus("This report does not have a preview or local file path.");
      return;
    }

    // Opening the file itself hands it to another app, so it is gated like Download.
    if (!(await ensureCanExport())) {
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
      setStatus("This report does not have a local file path.");
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
      const repositories = await getReportRepositories(userId);
      const ownedDocument =
        await repositories.generatedDocuments.getGeneratedDocumentById({
          id: document.id,
          userId,
        });
      if (!ownedDocument) {
        throw new Error("Report not found for this account.");
      }
      const fileResult =
        Platform.OS === "web"
          ? await deleteWebGeneratedDocumentFile(ownedDocument.local_uri)
          : await deleteNativeGeneratedDocumentFile(ownedDocument.local_uri);
      await repositories.generatedDocuments.deleteGeneratedDocument({
        id: ownedDocument.id,
        userId,
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
        {renderActions ? renderActions({ share: () => void handleShareDisputePack(), preview: () => void handlePreview(), csv: () => void handleGenerate("progress_claim_csv"), locked: exportLocked }) : null}
        {!renderActions ? <Text style={styles.eyebrow}>Weekly report</Text> : null}
        {exportLocked && (!renderActions || lockDetailsExpanded) ? (
          <View accessibilityLabel="Dispute pack locked" style={styles.list}>
            <Text style={styles.statusTitle}>{disputePackLockContent.title}</Text>
            {account.isGuest && subscription && !subscription.canCreateRecords ? (
              <Text style={styles.statusMessage}>{disputePackLockContent.guestTrialEnded}</Text>
            ) : null}
            <Text style={styles.statusMessage}>{disputePackLockContent.body}</Text>
            <Text style={styles.muted}>{disputePackLockContent.previewHint}</Text>
            {exportAccess.lock === "guest" ? (
              <Pressable accessibilityRole="button" onPress={onCreateAccount} style={styles.actionButtonSecondary}>
                <Text style={styles.actionButtonSecondaryText}>{disputePackLockContent.guestButton}</Text>
              </Pressable>
            ) : onOpenPlanBilling ? (
              <Pressable accessibilityRole="button" onPress={onOpenPlanBilling} style={styles.actionButtonSecondary}>
                <Text style={styles.actionButtonSecondaryText}>{disputePackLockContent.subscribeButton}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" disabled={!selectedProjectId} onPress={() => void handlePreview()} style={[styles.actionButtonSecondary, !selectedProjectId && styles.disabledButton]}>
              <Text style={[styles.actionButtonSecondaryText, (!selectedProjectId) && styles.disabledButtonText]}>Preview report</Text>
            </Pressable>
          </View>
        ) : !exportLocked && !renderActions ? (
          <Pressable onPress={() => void handleShareDisputePack()} style={styles.actionButton}><Text style={styles.actionButtonText}>Share report</Text></Pressable>
        ) : null}
        <Text style={styles.muted}>{subscriptionStatus}</Text>
      </View>
      {payStep ? <ProjectPayCard name={payStep.name} settings={payStep.settings} rateCents={projects.find((project) => project.id === selectedProjectId)?.hourlyRateCents ?? 0} onSave={savePay} /> : null}

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Status</Text>
        <Text style={styles.statusMessage}>{status}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Earlier reports</Text>
        {documents.length === 0 ? (
          <Text style={styles.muted}>
            No earlier reports on this phone yet.
          </Text>
        ) : (
          <View style={styles.list}>
            {documents.map((document) => (
              <View key={document.id} style={styles.row}>
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text style={styles.rowLabel}>{document.file_name}</Text>
                  <Text style={styles.muted}>
                    {formatDocumentType(document.document_type)} -{" "}
                    {document.period_start ?? "No start"} to{" "}
                    {document.period_end ?? "No end"}
                  </Text>
                </View>
                <View style={{ gap: space.xs }}>
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
                      accessibilityState={{ disabled: exportLocked }}
                      style={[styles.statusPill, exportLocked && styles.disabledButton]}
                    >
                      <Text style={[styles.statusPillText, (exportLocked) && styles.disabledButtonText]}>{exportLocked ? "Locked · Save to phone" : "Save to phone"}</Text>
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
                    <Text style={styles.statusPillText}>Open</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void handleShare(document)}
                    accessibilityState={{ disabled: exportLocked }}
                    style={[styles.statusPill, exportLocked && styles.disabledButton]}
                  >
                  <Text style={[styles.statusPillText, (exportLocked) && styles.disabledButtonText]}>{exportLocked ? "Locked · Share" : "Share"}</Text>
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

      {__DEV__ && Platform.OS === "web" && exportPreview ? (
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
                <View style={{ flex: 1, gap: space.xs }}>
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
                  <View style={{ flex: 1, gap: space.xs }}>
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
  expectedUserId: string | undefined,
  setSubscription: (value: SubscriptionEntitlement | null) => void,
  setSubscriptionStatus: (value: string) => void,
  setStatus: (value: string) => void,
): Promise<boolean> {
  if (canExportProgressClaim(subscription)) {
    return true;
  }

  setStatus("Checking subscription before export...");
  const result = await fetchSubscriptionStatus(expectedUserId);
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
  if (canExportProgressClaim(result.subscription)) {
    return true;
  }

  setStatus(disputePackLockContent.lockedStatus);
  return false;
}

function getErrorMessage(error: unknown): string {
  return "Something went wrong. Please try again.";
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
    .map((location) => location.address.split(" · ")[0])
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

async function getReportRepositories(userId: string) {
  if (Platform.OS === "web") {
    return getWebProgressClaimRepositories();
  }

  const { getLocalRepositories } = await import("../db/repositories");
  return getLocalRepositories(userId);
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
