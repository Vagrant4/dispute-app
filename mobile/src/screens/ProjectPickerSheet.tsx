import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SwipeDownSheet } from "../components/SwipeDownSheet";
import { styles } from "../styles";
import type { WorkProject } from "../work/workRepository";

type ProjectPickerSheetProps = {
  onClose: () => void;
  onSelect: (projectId: string) => void;
  projects: WorkProject[];
  testID: string;
  title?: string;
  footer?: ReactNode;
};

export function ProjectPickerSheet({ footer, onClose, onSelect, projects, testID, title = "Choose project" }: ProjectPickerSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <SwipeDownSheet
      backdropStyle={styles.projectSheetBackdrop}
      onClose={onClose}
      sheetStyle={[styles.projectSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
      testID={testID}
    >
      <Text style={styles.heading}>{title}</Text>
      {projects.map((project) => (
        <Pressable
          accessibilityRole="button"
          key={project.id}
          onPress={() => onSelect(project.id)}
          style={styles.dropdownOption}
        >
          <Text style={styles.body}>{project.name}</Text>
        </Pressable>
      ))}
      {footer}
    </SwipeDownSheet>
  );
}
