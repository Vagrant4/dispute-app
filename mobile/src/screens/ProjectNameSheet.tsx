import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { styles, theme } from "../styles";
export function ProjectNameSheet({ name = "", onSave, onClose }: { name?: string; onSave: (name: string) => Promise<void>; onClose: () => void }) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!value.trim() || busy) return;
    setBusy(true);
    try { await onSave(value.trim()); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save project."); }
    finally { setBusy(false); }
  }
  return <Modal transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.projectSheetBackdrop}>
      <View style={styles.projectSheet}>
        <Text style={styles.heading}>{name ? "Rename project" : "New project"}</Text>
        <Text style={styles.muted}>Just a name. Site and hours fill in when you start work.</Text>
        <TextInput accessibilityLabel="Project name" placeholder="Client or site name" placeholderTextColor={theme.colors.placeholder} value={value} onChangeText={setValue} style={styles.textInput} autoFocus />
        {error ? <Text style={styles.body}>{error}</Text> : null}
        <Pressable disabled={busy || !value.trim()} onPress={() => void save()} style={[styles.actionButton, (busy || !value.trim()) && styles.disabledButton]}>
          <Text style={styles.actionButtonText}>Save</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text style={styles.muted}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
