import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { LocalAccount } from "../auth/localAuth";
import type {
  ProjectGroup,
  WorkEntry,
  WorkProject,
  WorkTask,
} from "../work/workRepository";
import { getProjectScreenStore } from "../work/projectScreenStore";
import { styles, theme } from "../styles";
import { ProgressClaimReportsScreen } from "./ProgressClaimReportsScreen";
import { ProjectPickerSheet } from "./ProjectPickerSheet";
import { TaskPickerSheet } from "./TaskPickerSheet";
import { PhotoEvidenceScreen } from "./PhotoEvidenceScreen";

export function ProjectDetailScreen({
  account,
  projectId,
  onCreateAccount,
  onOpenPlanBilling,
  onSelectProject,
}: {
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
  const [actionError, setActionError] = useState("");
  async function refreshTasks() {
    const store = await getProjectScreenStore(userId);
    if ("listTasks" in store)
      setTasks(await store.listTasks(userId, projectId));
  }
  async function refreshEntries() {
    const store = await getProjectScreenStore(userId);
    if ("listProjectEntries" in store)
      setEntries(await store.listProjectEntries(userId, projectId));
  }
  useEffect(() => {
    void getProjectScreenStore(userId)
      .then((store) => store.listProjects(userId))
      .then((items) => {
        setProjects(items.filter((item) => item.status !== "archived"));
        const selected = items.find((item) => item.id === projectId) ?? null;
        setProject(selected);
        setSiteAddress(selected?.siteAddress ?? "");
      });
  }, [projectId, userId]);
  useEffect(() => {
    void refreshTasks();
  }, [projectId, userId]);
  useEffect(() => {
    void refreshEntries();
  }, [projectId, userId]);
  useEffect(() => {
    void getProjectScreenStore(userId)
      .then(
        (store) =>
          (
            store as typeof store & {
              listProjectGroups?: (id: string) => Promise<ProjectGroup[]>;
            }
          ).listProjectGroups?.(userId) ?? [],
      )
      .then(setGroups);
  }, [projectId, userId]);

  async function assignGroup(groupId: string | null) {
    try {
      const store = await getProjectScreenStore(userId);
      if (
        !("assignProjectGroup" in store) ||
        typeof store.assignProjectGroup !== "function"
      )
        throw new Error("Project groups are unavailable.");
      await store.assignProjectGroup(userId, projectId, groupId);
      setProject((current) => (current ? { ...current, groupId } : current));
      setActionError("");
    } catch {
      setActionError("Could not update the project group. Try again.");
    }
  }

  async function saveDiscovery(status = project?.projectStatus ?? "active") {
    try {
      const store = await getProjectScreenStore(userId);
      if (
        !("updateProjectDiscovery" in store) ||
        typeof store.updateProjectDiscovery !== "function"
      )
        throw new Error("Project discovery is unavailable.");
      const address = siteAddress.trim();
      const location = await import("expo-location");
      const result = address
        ? (await location.geocodeAsync(address).catch(() => []))[0]
        : undefined;
      await store.updateProjectDiscovery(userId, projectId, {
        status,
        siteAddress: address || null,
        siteLatitude: result?.latitude ?? project?.siteLatitude ?? null,
        siteLongitude: result?.longitude ?? project?.siteLongitude ?? null,
      });
      setProject((current) =>
        current
          ? {
              ...current,
              projectStatus: status,
              siteAddress: address || null,
              siteLatitude: result?.latitude ?? current.siteLatitude,
              siteLongitude: result?.longitude ?? current.siteLongitude,
            }
          : current,
      );
      setActionError("");
    } catch {
      setActionError("Could not save the project site. Try again.");
    }
  }

  function confirmArchive() {
    const message =
      "The project is archived (hidden from lists and pickers), all shifts, photos and reports are kept, and it can be restored from the Archived filter.";
    const archive = async () => {
      try {
        const store = await getProjectScreenStore(userId);
        await store.setProjectStatus(userId, projectId, "archived");
        setActionError("");
        onSelectProject("");
      } catch {
        setActionError("Could not archive this project. Try again.");
      }
    };
    if (Platform.OS === "web") {
      if (globalThis.confirm(message)) void archive();
    } else
      Alert.alert("Delete project", message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: () => void archive(),
        },
      ]);
  }

  return (
    <>
      <View style={styles.photoProjectHeader}>
        <Text style={styles.todayTitle}>{project?.name ?? "Project"}</Text>
        {project?.siteAddress ? (
          <Text style={styles.muted}>{project.siteAddress}</Text>
        ) : null}
        <View style={styles.projectStatusBadge}>
          <Text style={styles.projectStatusText}>
            {project?.projectStatus === "lead" ? "Lead" : project?.projectStatus === "completed" ? "Completed" : "Active"}
          </Text>
        </View>
      </View>
      <View testID="project-detail-actions" style={styles.projectDetailActions}>
        <Pressable
          testID="project-picker"
          accessibilityRole="button"
          onPress={() => setPickerOpen(true)}
          style={styles.dropdownBox}
        >
          <Text style={styles.dropdownValue}>
            {project?.name ?? "Choose project"}
          </Text>
          <Text style={styles.settingsDropdownChevron}>▼</Text>
        </Pressable>
        {pickerOpen ? (
          <ProjectPickerSheet
            onClose={() => setPickerOpen(false)}
            onSelect={(nextProjectId) => {
              setPickerOpen(false);
              onSelectProject(nextProjectId);
            }}
            projects={projects}
            testID="project-detail-picker-sheet"
          />
        ) : null}
        <Text style={styles.inputLabel}>Group</Text>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => void assignGroup(null)}
            style={!project?.groupId ? styles.chipSelected : styles.chip}
          >
            <Text
              style={
                !project?.groupId
                  ? styles.selectedSecondaryText
                  : styles.chipText
              }
            >
              None
            </Text>
          </Pressable>
          {groups.map((group) => (
            <Pressable
              key={group.id}
              onPress={() => void assignGroup(group.id)}
              style={
                project?.groupId === group.id
                  ? styles.chipSelected
                  : styles.chip
              }
            >
              <Text
                style={
                  project?.groupId === group.id
                    ? styles.selectedSecondaryText
                    : styles.chipText
                }
              >
                {group.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.inputLabel}>Site address</Text>
        <TextInput
          accessibilityLabel="Site address"
          onChangeText={setSiteAddress}
          placeholder="Optional site address"
          placeholderTextColor={theme.colors.placeholder}
          style={styles.textInput}
          value={siteAddress}
        />
        <View style={styles.chipRow}>
          {(["lead", "active", "completed"] as const).map((status) => (
            <Pressable
              key={status}
              onPress={() => void saveDiscovery(status)}
              style={
                project?.projectStatus === status
                  ? styles.chipSelected
                  : styles.chip
              }
            >
              <Text
                style={
                  project?.projectStatus === status
                    ? styles.selectedSecondaryText
                    : styles.chipText
                }
              >
              {status[0].toUpperCase() + status.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => void saveDiscovery()}
          style={styles.actionButtonSecondary}
        >
          <Text style={styles.actionButtonSecondaryText}>Save site</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTasksOpen(true)}
          style={styles.actionButtonSecondary}
        >
          <Text style={styles.actionButtonSecondaryText}>
            Tasks ({tasks.length})
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={confirmArchive}
          style={styles.dangerButtonSecondary}
        >
          <Text style={styles.dangerButtonSecondaryText}>Delete project</Text>
        </Pressable>
        {actionError ? (
          <Text accessibilityRole="alert" style={styles.projectActionError}>
            {actionError}
          </Text>
        ) : null}
      </View>
      {tasksOpen ? (
        <TaskPickerSheet
          manage
          tasks={tasks}
          onClose={() => setTasksOpen(false)}
          onAdd={async (name) => {
            const store = await getProjectScreenStore(userId);
            await store.addTask({ userId, projectId, name });
            await refreshTasks();
          }}
          onRename={async (taskId, name) => {
            const store = await getProjectScreenStore(userId);
            await store.renameTask({ userId, taskId, name });
            await refreshTasks();
          }}
        />
      ) : null}
      <View style={styles.projectShiftList}>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.projectShiftRow}>
            <Text style={styles.projectShiftDate}>{entry.workDate}</Text>
            <Text style={styles.projectShiftDuration}>
              {entry.durationMinutes} min
              {entry.breakMinutes ? ` · Break ${entry.breakMinutes} min` : ""}
            </Text>
            {entry.locationNote ? (
              <Text style={styles.muted}>
                {entry.locationNote}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      <PhotoEvidenceScreen
        account={account}
        initialProjectId={projectId}
        projectScoped
      />
      <View style={styles.projectReportSection}>
        <ProgressClaimReportsScreen
          account={account}
          projectId={projectId}
          onCreateAccount={onCreateAccount}
          onOpenPlanBilling={onOpenPlanBilling}
          renderActions={({ share }) => (
            <Pressable
              testID="create-share-pdf"
              accessibilityRole="button"
              onPress={share}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonText}>
                Create &amp; share PDF
              </Text>
            </Pressable>
          )}
        />
      </View>
    </>
  );
}
