import { useEffect, useState } from "react";
import * as Location from "expo-location";
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { LocalAccount } from "../auth/localAuth";
import type {
  WorkEntry,
  WorkProject,
  WorkTask,
} from "../work/workRepository";
import { getProjectScreenStore } from "../work/projectScreenStore";
import { styles, theme } from "../styles";
import { projectAddressLabel } from "../work/projectAddress";
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
  initialSiteNotice,
}: {
  account: LocalAccount;
  projectId: string;
  onCreateAccount: () => void;
  onOpenPlanBilling?: () => void;
  onSelectProject: (projectId: string) => void;
  initialSiteNotice?: string;
}) {
  const userId = account.id ?? account.email.trim().toLowerCase();
  const [project, setProject] = useState<WorkProject | null>(null);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [siteAddress, setSiteAddress] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"active" | "completed">("active");
  const [savedSite, setSavedSite] = useState<{
    address: string;
    status: "active" | "completed";
  }>({ address: "", status: "active" });
  const [actionError, setActionError] = useState("");
  const [siteNotice, setSiteNotice] = useState(initialSiteNotice ?? "");
  const [saveConfirmation, setSaveConfirmation] = useState("");
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const archiveExplanation = "The project is archived (hidden from lists and pickers), all shifts, photos and reports are kept, and it can be restored from the Archived filter.";
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
        const status = selected?.projectStatus === "completed" ? "completed" : "active";
        const address = selected?.siteAddress ?? "";
        setSiteAddress(address);
        setSelectedStatus(status);
        setSavedSite({ address: address.trim(), status });
      });
  }, [projectId, userId]);
  useEffect(() => {
    void refreshTasks();
  }, [projectId, userId]);
  useEffect(() => {
    void refreshEntries();
  }, [projectId, userId]);
  const isSiteDirty = siteAddress.trim() !== savedSite.address || selectedStatus !== savedSite.status;

  async function saveDiscovery() {
    try {
      const store = await getProjectScreenStore(userId);
      if (
        !("updateProjectDiscovery" in store) ||
        typeof store.updateProjectDiscovery !== "function"
      )
        throw new Error("Project discovery is unavailable.");
      const address = siteAddress.trim();
      const result = address
        ? (await Location.geocodeAsync(address).catch(() => []))[0]
        : undefined;
      await store.updateProjectDiscovery(userId, projectId, {
        status: selectedStatus,
        siteAddress: address || null,
        siteLatitude: result?.latitude ?? null,
        siteLongitude: result?.longitude ?? null,
      });
      setProject((current) =>
        current
          ? {
              ...current,
              projectStatus: selectedStatus,
              siteAddress: address || null,
              siteLatitude: result?.latitude ?? null,
              siteLongitude: result?.longitude ?? null,
            }
          : current,
      );
      setActionError("");
      setSiteAddress(address);
      setSavedSite({ address, status: selectedStatus });
      setSiteNotice(
        address && !result
          ? "Address saved. Couldn't locate it on the map, so distance isn't shown."
          : "",
      );
      setSaveConfirmation("Saved ✓");
      setTimeout(() => setSaveConfirmation(""), 2_000);
    } catch {
      setActionError("Could not save the project site. Try again.");
    }
  }

  async function archiveProject() {
    try {
      const store = await getProjectScreenStore(userId);
      await store.setProjectStatus(userId, projectId, "archived");
      setArchiveConfirmOpen(false);
      setActionError("");
      onSelectProject("");
    } catch {
      setArchiveConfirmOpen(false);
      setActionError("Could not archive this project. Try again.");
    }
  }

  return (
    <>
      <View style={styles.photoProjectHeader}>
        <Text style={styles.todayTitle}>{project?.name ?? "Project"}</Text>
        <Text style={styles.muted}>{projectAddressLabel(project?.siteAddress)}</Text>
        <View style={styles.projectStatusBadge}>
          <Text style={styles.projectStatusText}>
            {project?.projectStatus === "completed" ? "Completed" : "Active"}
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
          {(["active", "completed"] as const).map((status) => (
            <Pressable
              key={status}
                onPress={() => setSelectedStatus(status)}
              style={
                selectedStatus === status
                  ? styles.chipSelected
                  : styles.chip
              }
            >
              <Text
                style={[
                  styles.projectStatusChipText,
                  selectedStatus === status
                    ? styles.projectStatusChipTextSelected
                    : styles.projectStatusChipTextUnselected,
                ]}
              >
              {status[0].toUpperCase() + status.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTasksOpen(true)}
          style={styles.actionButtonSecondary}
          testID="project-detail-tasks"
        >
          <Text style={styles.actionButtonSecondaryText}>
            Tasks ({tasks.length})
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Save"
          accessibilityRole="button"
          accessibilityState={{ disabled: !isSiteDirty }}
          disabled={!isSiteDirty}
          onPress={() => void saveDiscovery()}
          style={[styles.actionButtonSecondary, { alignItems: "center" }, !isSiteDirty && styles.disabledButton]}
          testID="project-detail-save"
        >
          <Text style={[styles.actionButtonSecondaryText, { textAlign: "center" }, !isSiteDirty && styles.disabledButtonText]}>Save</Text>
        </Pressable>
        {saveConfirmation ? (
          <Text testID="save-site-confirmation" style={styles.muted}>
            {saveConfirmation}
          </Text>
        ) : null}
        {siteNotice ? <Text style={styles.muted}>{siteNotice}</Text> : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => setArchiveConfirmOpen(true)}
          style={[styles.dangerButtonSecondary, { alignItems: "center" }]}
          testID="project-detail-delete"
        >
          <Text style={[styles.dangerButtonSecondaryText, { textAlign: "center" }]}>Delete project</Text>
        </Pressable>
        {actionError ? (
          <Text accessibilityRole="alert" style={styles.projectActionError}>
            {actionError}
          </Text>
        ) : null}
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => setArchiveConfirmOpen(false)}
        transparent
        visible={archiveConfirmOpen}
      >
        <View style={styles.archiveModalBackdrop}>
          <View
            accessibilityRole="alert"
            style={styles.archiveModalDialog}
            testID="archive-confirm-dialog"
          >
            <Text style={styles.heading}>Delete project</Text>
            <Text style={styles.body}>{archiveExplanation}</Text>
            <View style={styles.archiveModalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setArchiveConfirmOpen(false)}
                style={styles.archiveModalCancel}
                testID="archive-confirm-cancel"
              >
                <Text style={styles.archiveModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void archiveProject()}
                style={styles.dangerButton}
                testID="archive-confirm-archive"
              >
                <Text style={styles.dangerButtonText}>Archive</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
