import { useState } from "react";
import { Pressable, Text, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles, theme } from "../styles";
import { KeyboardAwareScroll } from "../components/KeyboardAwareScroll";
import { SwipeDownSheet } from "../components/SwipeDownSheet";
export function ProjectNameSheet({ name = "", onSave, onClose }: { name?: string; onSave: (name: string) => Promise<void>; onClose: () => void }) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const insets = useSafeAreaInsets();
  async function save() {
    if (!value.trim() || busy) return;
    setBusy(true);
    try { await onSave(value.trim()); onClose(); }
    catch (cause) { setError("Could not save project."); }
    finally { setBusy(false); }
  }
  return <SwipeDownSheet backdropStyle={styles.projectSheetBackdrop} onClose={onClose} sheetStyle={styles.projectSheet} testID="project-sheet">
      <KeyboardAwareScroll bottomPadding={Math.max(insets.bottom, 24)} contentContainerStyle={styles.projectSheetContent} fill={false}>
        <Text style={styles.heading}>{name ? "Rename project" : "New project"}</Text>
        <Text style={styles.muted}>Just a name. Site and hours fill in when you start work.</Text>
        <TextInput accessibilityLabel="Project name" placeholder="Client or site name" placeholderTextColor={theme.colors.placeholder} value={value} onChangeText={setValue} style={styles.textInput} autoFocus />
        {error ? <Text style={styles.body}>{error}</Text> : null}
        <Pressable disabled={busy || !value.trim()} onPress={() => void save()} style={[styles.actionButtonSecondary, (busy || !value.trim()) && styles.disabledButton]}>
          <Text style={[styles.actionButtonSecondaryText, ((busy || !value.trim())) && styles.disabledButtonText]}>Save</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text style={styles.muted}>Cancel</Text>
        </Pressable>
      </KeyboardAwareScroll>
  </SwipeDownSheet>;
}
