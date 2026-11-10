import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { LocalAccount } from "../auth/localAuth";
import type { ProjectGroup, WorkEntry, WorkProject, WorkTask } from "../work/workRepository";
import { getProjectScreenStore } from "../work/projectScreenStore";
import { styles, theme } from "../styles";
import { ProgressClaimReportsScreen } from "./ProgressClaimReportsScreen";
import { ProjectPickerSheet } from "./ProjectPickerSheet";
import { TaskPickerSheet } from "./TaskPickerSheet";
import { PhotoEvidenceScreen } from "./PhotoEvidenceScreen";

export function ProjectDetailScreen({ account, projectId, onCreateAccount, onOpenPlanBilling, onSelectProject }: {
  account: LocalAccount;
  projectId: string;
  onCreateAccount: () => void;
  onOpenPlanBilling?: () => void;
  onSelectProject: (projectId: string) => void;
}) {
  const userId = account.id ?? account.email.trim().toLowerCase();
  const [project, setProject] = useState<WorkProject | null>(null);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [siteAddress, setSiteAddress] = useState("");
  async function refreshTasks() { const store = await getProjectScreenStore(userId); if ("listTasks" in store) setTasks(await store.listTasks(userId, projectId)); }
  async function refreshEntries() { const store = await getProjectScreenStore(userId); if ("listProjectEntries" in store) setEntries(await store.listProjectEntries(userId, projectId)); }
  useEffect(() => {
    void getProjectScreenStore(userId)
      .then((store) => store.listProjects(userId))
      .then((items) => {
        setProjects(items.filter((item) => item.status !== "archived"));
        const selected = items.find((item) => item.id === projectId) ?? null;
        setProject(selected); setSiteAddress(selected?.siteAddress ?? "");
      });
  }, [projectId, userId]);
  useEffect(() => { void refreshTasks(); }, [projectId, userId]);
  useEffect(() => { void refreshEntries(); }, [projectId, userId]);
  useEffect(() => { void getProjectScreenStore(userId).then((store) => (store as typeof store & { listProjectGroups?: (id: string) => Promise<ProjectGroup[]> }).listProjectGroups?.(userId) ?? []).then(setGroups); }, [projectId, userId]);

  async function assignGroup(groupId: string | null) {
    const store = await getProjectScreenStore(userId) as Awaited<ReturnType<typeof getProjectScreenStore>> & { assignProjectGroup?: (userId: string, projectId: string, groupId: string | null) => Promise<void> };
    await store.assignProjectGroup?.(userId, projectId, groupId);
    setProject((current) => current ? { ...current, groupId } : current);
  }

  async function saveDiscovery(status = project?.projectStatus ?? "active") {
    const store = await getProjectScreenStore(userId) as Awaited<ReturnType<typeof getProjectScreenStore>> & { updateProjectDiscovery?: (userId: string, projectId: string, fields: { status: "lead" | "active" | "completed"; siteAddress: string | null; siteLatitude: number | null; siteLongitude: number | null }) => Promise<void> };
    const address = siteAddress.trim();
    const location = await import("expo-location");
    const result = address ? (await location.geocodeAsync(address).catch(() => []))[0] : undefined;
    await store.updateProjectDiscovery?.(userId, projectId, { status, siteAddress: address || null, siteLatitude: result?.latitude ?? project?.siteLatitude ?? null, siteLongitude: result?.longitude ?? project?.siteLongitude ?? null });
    setProject((current) => current ? { ...current, projectStatus: status, siteAddress: address || null, siteLatitude: result?.latitude ?? current.siteLatitude, siteLongitude: result?.longitude ?? current.siteLongitude } : current);
  }

  return <>
    <View style={styles.photoProjectHeader}><Text style={styles.todayTitle}>{project?.name ?? "Project"}</Text>{project?.siteAddress ? <Text style={styles.muted}>{project.siteAddress}</Text> : null}<View style={styles.projectStatusBadge}><Text style={styles.projectStatusText}>{project?.projectStatus ?? "active"}</Text></View></View>
    <Pressable testID="project-picker" accessibilityRole="button" onPress={() => setPickerOpen(true)} style={styles.dropdownBox}>
      <Text style={styles.dropdownValue}>{project?.name ?? "Choose project"}</Text>
      <Text style={styles.settingsDropdownChevron}>▼</Text>
    </Pressable>
    {pickerOpen ? <ProjectPickerSheet
      onClose={() => setPickerOpen(false)}
      onSelect={(nextProjectId) => { setPickerOpen(false); onSelectProject(nextProjectId); }}
      projects={projects}
      testID="project-detail-picker-sheet"
    /> : null}
    <Text style={styles.inputLabel}>Group</Text><View style={styles.chipRow}><Pressable onPress={() => void assignGroup(null)} style={!project?.groupId ? styles.chipSelected : styles.chip}><Text style={!project?.groupId ? styles.selectedSecondaryText : styles.chipText}>None</Text></Pressable>{groups.map((group) => <Pressable key={group.id} onPress={() => void assignGroup(group.id)} style={project?.groupId === group.id ? styles.chipSelected : styles.chip}><Text style={project?.groupId === group.id ? styles.selectedSecondaryText : styles.chipText}>{group.name}</Text></Pressable>)}</View>
    <Text style={styles.inputLabel}>Site address</Text><TextInput accessibilityLabel="Site address" onChangeText={setSiteAddress} placeholder="Optional site address" placeholderTextColor={theme.colors.placeholder} style={styles.textInput} value={siteAddress} />
    <View style={styles.chipRow}>{(["lead", "active", "completed"] as const).map((status) => <Pressable key={status} onPress={() => void saveDiscovery(status)} style={project?.projectStatus === status ? styles.chipSelected : styles.chip}><Text style={project?.projectStatus === status ? styles.selectedSecondaryText : styles.chipText}>{status}</Text></Pressable>)}</View>
    <Pressable onPress={() => void saveDiscovery()} style={styles.actionButtonSecondary}><Text style={styles.actionButtonSecondaryText}>Save site</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => setTasksOpen(true)} style={styles.actionButtonSecondary}><Text style={styles.actionButtonSecondaryText}>Tasks ({tasks.length})</Text></Pressable>
    {tasksOpen ? <TaskPickerSheet manage tasks={tasks} onClose={() => setTasksOpen(false)} onAdd={async (name) => { const store = await getProjectScreenStore(userId); await store.addTask({ userId, projectId, name }); await refreshTasks(); }} onRename={async (taskId, name) => { const store = await getProjectScreenStore(userId); await store.renameTask({ userId, taskId, name }); await refreshTasks(); }} /> : null}
    {entries.map((entry) => <Text key={entry.id} style={styles.muted}>Shift record: {entry.workDate} · {entry.durationMinutes} min{entry.breakMinutes ? ` · Break ${entry.breakMinutes} min` : ""}{entry.locationNote ? ` · Note: ${entry.locationNote}` : ""}</Text>)}
    <PhotoEvidenceScreen account={account} initialProjectId={projectId} />
    <ProgressClaimReportsScreen
      account={account}
      projectId={projectId}
      onCreateAccount={onCreateAccount}
      onOpenPlanBilling={onOpenPlanBilling}
      renderActions={({ share }) => (
        <Pressable testID="create-share-pdf" accessibilityRole="button" onPress={share} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Create &amp; share PDF</Text>
        </Pressable>
      )}
    />
  </>;
}
