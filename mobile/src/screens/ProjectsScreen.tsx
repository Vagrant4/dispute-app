import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { LocalAccount } from "../auth/localAuth";
import type { ProjectSummary } from "../work/workRepository";
import { currentWeekStart, getProjectScreenStore } from "../work/projectScreenStore";
import { useSubscriptionAccess } from "../subscription/useSubscriptionAccess";
import { styles } from "../styles";
import { ProjectNameSheet } from "./ProjectNameSheet";
import { ProjectDetailScreen } from "./ProjectDetailScreen";
export function ProjectsScreen({ account, onCreateAccount, onOpenPlanBilling, onSeePhotos }: { account: LocalAccount; onCreateAccount: () => void; onOpenPlanBilling?: () => void; onSeePhotos: (projectId: string) => void }) {
  const userId = account.id ?? account.email.trim().toLowerCase();
  const access = useSubscriptionAccess(account);
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  async function refresh() { try { const store = await getProjectScreenStore(userId); setSummaries(await store.listProjectSummaries(userId, currentWeekStart())); } catch (cause) { setError("Could not load projects."); } }
  useEffect(() => { void refresh(); }, [userId]);
  async function create(name: string) {
    if (!access.canCreateRecords) throw new Error(access.message);
    const store = await getProjectScreenStore(userId);
    const clients = await store.listClients(userId);
    const client = clients[0] ?? await store.createClient({ userId, name: "My client" });
    const project = await store.createProject({ userId, clientId: client.id, name, hourlyRateCents: 0 });
    await refresh(); setOpenProjectId(project.id);
  }
  if (openProjectId) return <ProjectDetailScreen key={openProjectId} account={account} projectId={openProjectId} onBack={() => { setOpenProjectId(null); void refresh(); }} onCreateAccount={onCreateAccount} onOpenPlanBilling={onOpenPlanBilling} onSeePhotos={onSeePhotos} />;
  const card = (project: ProjectSummary) => <Pressable key={project.id} onPress={() => setOpenProjectId(project.id)} style={styles.card} accessibilityRole="button">
    <View style={styles.row}>
      <Text style={styles.heading}>{project.name}</Text>{project.isActive ? <Text style={styles.statusPillText}>● Working</Text> : null}</View>
    <Text style={styles.muted}>📍 {project.lastSiteAddress ?? "No GPS site recorded"}</Text>
    <Text style={styles.muted}>Last worked: {project.lastWorkedAt ? new Date(project.lastWorkedAt).toLocaleDateString() : "No sessions yet"}</Text>
    <Text style={styles.body}>{Math.floor(project.minutesThisWeek / 60)}h {project.minutesThisWeek % 60}m this week · {project.photoCount} photos · Open ›</Text>
  </Pressable>;
  return <>
    <View style={styles.row}>
      <Text style={styles.heading}>Projects</Text>
      <Pressable disabled={!access.canCreateRecords} onPress={() => setCreating(true)} style={[styles.actionButton, !access.canCreateRecords && styles.disabledButton]}>
        <Text style={[styles.actionButtonText, (!access.canCreateRecords) && styles.disabledButtonText]}>+ New</Text>
      </Pressable>
    </View>
    {error ? <Text style={styles.body}>{error}</Text> : null}
    {summaries.filter((project) => project.status !== "archived").map(card)}
    {!summaries.length ? <Text style={styles.muted}>Start work on Today or add your first project.</Text> : null}
    <Pressable accessibilityState={{ expanded: finished }} onPress={() => setFinished(!finished)}>
      <Text style={styles.body}>Finished ({summaries.filter((project) => project.status === "archived").length}) {finished ? "▲" : "▼"}</Text>
    </Pressable>
    {finished ? summaries.filter((project) => project.status === "archived").map(card) : null}
    {creating ? <ProjectNameSheet onSave={create} onClose={() => setCreating(false)} /> : null}
  </>;
}
