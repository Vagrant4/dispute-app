import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import type { LocalAccount } from "../auth/localAuth";
import type { WorkProject } from "../work/workRepository";
import { getProjectScreenStore } from "../work/projectScreenStore";
import { styles } from "../styles";
import { ProgressClaimReportsScreen } from "./ProgressClaimReportsScreen";
import { ProjectPickerSheet } from "./ProjectPickerSheet";

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
  useEffect(() => {
    void getProjectScreenStore(userId)
      .then((store) => store.listProjects(userId))
      .then((items) => {
        setProjects(items.filter((item) => item.status !== "archived"));
        setProject(items.find((item) => item.id === projectId) ?? null);
      });
  }, [projectId, userId]);

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
