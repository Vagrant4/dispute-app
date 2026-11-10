import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import type { LocalAccount } from "../auth/localAuth";
import type { WorkEntry, WorkProject, WorkTask } from "../work/workRepository";
import { getProjectScreenStore } from "../work/projectScreenStore";
import { styles } from "../styles";
import { ProgressClaimReportsScreen } from "./ProgressClaimReportsScreen";
import { ProjectPickerSheet } from "./ProjectPickerSheet";
import { TaskPickerSheet } from "./TaskPickerSheet";

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
  async function refreshTasks() { const store = await getProjectScreenStore(userId); if ("listTasks" in store) setTasks(await store.listTasks(userId, projectId)); }
  async function refreshEntries() { const store = await getProjectScreenStore(userId); if ("listProjectEntries" in store) setEntries(await store.listProjectEntries(userId, projectId)); }
  useEffect(() => {
    void getProjectScreenStore(userId)
      .then((store) => store.listProjects(userId))
      .then((items) => {
        setProjects(items.filter((item) => item.status !== "archived"));
        setProject(items.find((item) => item.id === projectId) ?? null);
      });
  }, [projectId, userId]);
  useEffect(() => { void refreshTasks(); }, [projectId, userId]);
  useEffect(() => { void refreshEntries(); }, [projectId, userId]);

  return <>
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
    <Pressable accessibilityRole="button" onPress={() => setTasksOpen(true)} style={styles.actionButtonSecondary}><Text style={styles.actionButtonSecondaryText}>Tasks ({tasks.length})</Text></Pressable>
    {tasksOpen ? <TaskPickerSheet manage tasks={tasks} onClose={() => setTasksOpen(false)} onAdd={async (name) => { const store = await getProjectScreenStore(userId); await store.addTask({ userId, projectId, name }); await refreshTasks(); }} onRename={async (taskId, name) => { const store = await getProjectScreenStore(userId); await store.renameTask({ userId, taskId, name }); await refreshTasks(); }} /> : null}
    {entries.map((entry) => <Text key={entry.id} style={styles.muted}>Shift record: {entry.workDate} · {entry.durationMinutes} min{entry.breakMinutes ? ` · Break ${entry.breakMinutes} min` : ""}{entry.locationNote ? ` · Note: ${entry.locationNote}` : ""}</Text>)}
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
