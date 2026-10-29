import { useEffect, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import type { LocalAccount } from "../auth/localAuth";
import type { WorkEntry, WorkProject, ProjectSummary } from "../work/workRepository";
import type { PhotoEvidenceRow } from "../photos/photoEvidenceRepository";
import { formatLocationChip } from "../work/locationEvidence";
import { currentWeekStart, getProjectScreenStore } from "../work/projectScreenStore";
import { useSubscriptionAccess } from "../subscription/useSubscriptionAccess";
import { loadWorkHours } from "../work/workHoursSettings";
import { buildProjectWeekReport } from "../reports/projectWeekReport";
import { styles } from "../styles";
import { formatProjectSite } from "../work/projectSite";
import { ProjectNameSheet } from "./ProjectNameSheet";
import { ProgressClaimReportsScreen } from "./ProgressClaimReportsScreen";
export function ProjectDetailScreen({ account, projectId, onBack, onCreateAccount, onOpenPlanBilling, onSeePhotos }: { account: LocalAccount; projectId: string; onBack: () => void; onCreateAccount: () => void; onOpenPlanBilling?: () => void; onSeePhotos: (projectId: string) => void }) {
  const userId = account.id ?? account.email.trim().toLowerCase();
  const access = useSubscriptionAccess(account);
  const [project, setProject] = useState<WorkProject | null>(null);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [photos, setPhotos] = useState<PhotoEvidenceRow[]>([]);
  const [paySetupRequest, setPaySetupRequest] = useState(0);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const [rename, setRename] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [totals, setTotals] = useState({ totalOvertimeHours: 0, totalClaimAmountCents: 0 });
  const [error, setError] = useState("");
  async function refresh() {
    try {
      const store = await getProjectScreenStore(userId);
      const [projects, summaries, sessions, preferences] = await Promise.all([store.listProjects(userId), store.listProjectSummaries(userId, currentWeekStart()), store.listProjectEntries(userId, projectId), loadWorkHours(userId)]);
      const selected = projects.find((item) => item.id === projectId) ?? null;
      setProject(selected); setSummary(summaries.find((item) => item.id === projectId) ?? null); setEntries(sessions);
      if (selected) {
        const report = buildProjectWeekReport({
          weekStart: currentWeekStart(),
          input: {
            project: selected,
            timeEntries: sessions,
            pay: {
              ...preferences.settings,
              hourlyRateCents: selected.hourlyRateCents,
              dailyNormalMinutes: preferences.settings.dailyHours * 60,
            },
          },
        });
        setTotals(report.totals);
      }
      const rows: PhotoEvidenceRow[] = Platform.OS === "web" ? JSON.parse(globalThis.localStorage?.getItem(`dispute-web-saved-photo-evidence:${encodeURIComponent(userId)}`) || "[]") : await (await (await import("../db/repositories")).getLocalRepositories(userId)).photoEvidence.listRecentPhotoEvidence({ userId });
      setPhotos(rows.filter((photo) => photo.project_id === projectId));
    } catch (cause) { setError("Could not load project."); }
  }
  useEffect(() => { void refresh(); }, [userId, projectId]);
  async function saveName(name: string) { if (!project || !access.canCreateRecords) throw new Error(access.message); const store = await getProjectScreenStore(userId); await store.updateProject({ userId, projectId, name, description: project.description, hourlyRateCents: project.hourlyRateCents }); await refresh(); }
  async function toggleFinished() { try { const store = await getProjectScreenStore(userId); await store.setProjectStatus(userId, projectId, project?.status === "archived" ? "active" : "archived"); await refresh(); } catch (cause) { setError("Could not update project."); } }
  return <>
    <Pressable style={styles.textButton} onPress={onBack}>
      <Text style={styles.body}>‹ Projects</Text>
    </Pressable>
    {error ? <Text style={styles.body}>{error}</Text> : null}
    {project ? <>
      <View style={styles.card}>
        <Text style={styles.heading}>{project.name}</Text>
        <Text style={styles.muted}>{formatProjectSite(summary)}</Text>
        <Pressable accessibilityRole="button" style={[styles.actionButtonSecondary, (!access.canCreateRecords) && styles.disabledButton]} disabled={!access.canCreateRecords} onPress={() => setRename(true)}>
          <Text style={[styles.actionButtonSecondaryText, (!access.canCreateRecords) && styles.disabledButtonText]}>Rename</Text>
        </Pressable>
        <Text style={styles.metricValue}>{((summary?.minutesThisWeek ?? 0) / 60).toFixed(1)} h</Text>
        <Text style={styles.metricLabel}>This week</Text>
        <Pressable accessibilityRole="button" style={styles.actionButtonSecondary} onPress={() => void toggleFinished()}>
          <Text style={styles.actionButtonSecondaryText}>{project.status === "archived" ? "Reopen" : "Mark finished"}</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: sessionsExpanded }} onPress={() => setSessionsExpanded((value) => !value)} style={styles.actionButtonSecondary}>
        <Text style={styles.actionButtonSecondaryText}>Show sessions {sessionsExpanded ? "▲" : "▼"}</Text>
      </Pressable>
      {sessionsExpanded ? <>
        <Pressable style={styles.textButton} onPress={() => setPaySetupRequest((value) => value + 1)}>
          <Text style={styles.body}>Pay rate: {project.hourlyRateCents > 0 ? `SGD ${(project.hourlyRateCents / 100).toFixed(2)} / hour` : "Set pay rate"} ›</Text>
        </Pressable>

        <View style={styles.metricGrid}>{[["This week", `${((summary?.minutesThisWeek ?? 0) / 60).toFixed(1)}h`], ["OT", `${totals.totalOvertimeHours.toFixed(1)}h`], ["Est. pay", project.hourlyRateCents > 0 ? `SGD ${(totals.totalClaimAmountCents / 100).toFixed(2)}` : "Set pay rate"]].map(([label, value]) => <Pressable key={label} accessibilityRole={label === "Est. pay" ? "button" : undefined} onPress={label === "Est. pay" ? () => setPaySetupRequest((value) => value + 1) : undefined} style={styles.metricTile}>
          <Text style={styles.metricLabel}>{label}</Text>
          <Text style={styles.metricValue}>{value}</Text>
        </Pressable>)}</View>
      <View style={styles.card}>
        <Text style={styles.heading}>Sessions</Text>{entries.map((entry) => <Pressable key={entry.id} onPress={() => setExpanded(expanded === entry.id ? null : entry.id)} style={styles.list}>
          <Text style={styles.body}>{entry.workDate} · {time(entry.startTime)} – {entry.endTime ? time(entry.endTime) : "working"} · {(entry.durationMinutes / 60).toFixed(1)}h</Text>
          {expanded === entry.id ? <>{(["start", "stop"] as const).map((phase) => <Text key={phase} style={styles.muted}>{phase}: {formatLocationChip({ phase, source: (phase === "start" ? entry.clockInLocationSource : entry.clockOutLocationSource) ?? "legacy", address: phase === "start" ? entry.locationText : entry.clockOutLocationText ?? null, latitude: phase === "start" ? entry.clockInGpsLatitude : entry.clockOutGpsLatitude, longitude: phase === "start" ? entry.clockInGpsLongitude : entry.clockOutGpsLongitude, accuracy: (phase === "start" ? entry.clockInGpsAccuracyM : entry.clockOutGpsAccuracyM) ?? null, locatedAt: (phase === "start" ? entry.clockInLocatedAt : entry.clockOutLocatedAt) ?? null }, false)}</Text>)}</> : null}
        </Pressable>)}{!entries.length ? <Text style={styles.muted}>No sessions yet.</Text> : null}</View>
      </> : null}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.heading}>Photos · {photos.length}</Text>
          <Pressable style={styles.textButton} onPress={() => onSeePhotos(projectId)}>
            <Text style={styles.body}>See all ›</Text>
          </Pressable>
        </View>
        <View style={styles.actionRow}>{photos.slice(0, 4).map((photo) => <Image key={photo.id} source={{ uri: photo.local_uri }} style={styles.projectPhoto} />)}</View>
      </View>
      <ProgressClaimReportsScreen account={account} projectId={projectId} paySetupRequest={paySetupRequest} onPaySaved={() => void refresh()} onCreateAccount={onCreateAccount} onOpenPlanBilling={onOpenPlanBilling} renderActions={({ share, preview, csv, locked }) => <>
        {!locked ? <Pressable accessibilityRole="button" onPress={share} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>{"Create & share PDF"}</Text>
        </Pressable> : null}
        <Text style={styles.muted}>Week {currentWeekStart()} – {weekEnd()}</Text>
        <View style={styles.actionRow}>{!locked ? <Pressable style={styles.textButton} onPress={preview}>
          <Text style={styles.body}>Preview</Text>
        </Pressable> : null}<Pressable style={[styles.textButton, (locked) && styles.disabledButton]} disabled={locked} onPress={csv}>
            <Text style={[styles.muted, (locked) && styles.disabledButtonText]}>CSV</Text>
          </Pressable>
        </View>
      </>} />
      {rename ? <ProjectNameSheet name={project.name} onSave={saveName} onClose={() => setRename(false)} /> : null}</> : null}
  </>;
}
function time(value: string | null) { return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"; }
function weekEnd() { const end = new Date(`${currentWeekStart()}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 6); return end.toISOString().slice(0, 10); }
