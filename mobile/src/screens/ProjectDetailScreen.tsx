import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import type { LocalAccount } from "../auth/localAuth";
import type { WorkProject } from "../work/workRepository";
import { getProjectScreenStore } from "../work/projectScreenStore";
import { styles } from "../styles";
import { ProgressClaimReportsScreen } from "./ProgressClaimReportsScreen";

export function ProjectDetailScreen({ account, projectId, onBack, onCreateAccount, onOpenPlanBilling }: {
  account: LocalAccount;
  projectId: string;
  onBack: () => void;
  onCreateAccount: () => void;
  onOpenPlanBilling?: () => void;
}) {
  const userId = account.id ?? account.email.trim().toLowerCase();
  const [project, setProject] = useState<WorkProject | null>(null);
  useEffect(() => {
    void getProjectScreenStore(userId)
      .then((store) => store.listProjects(userId))
      .then((projects) => setProject(projects.find((item) => item.id === projectId) ?? null));
  }, [projectId, userId]);

  return <>
    <Pressable testID="project-picker" accessibilityRole="button" onPress={onBack} style={styles.dropdownBox}>
      <Text style={styles.dropdownValue}>{project?.name ?? "Choose project"}</Text>
      <Text style={styles.settingsDropdownChevron}>▼</Text>
    </Pressable>
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
