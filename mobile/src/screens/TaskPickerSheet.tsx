import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SwipeDownSheet } from "../components/SwipeDownSheet";
import type { WorkTask } from "../work/workRepository";
import { styles, theme } from "../styles";

export function TaskPickerSheet({ tasks, selectedId, onClose, onSelect, onAdd, onRename, manage = false }: { tasks: WorkTask[]; selectedId?: string | null; onClose: () => void; onSelect?: (id: string) => void; onAdd: (name: string) => Promise<void>; onRename?: (id: string, name: string) => Promise<void>; manage?: boolean }) {
  const [name, setName] = useState(""); const [editing, setEditing] = useState<WorkTask | null>(null); const [status, setStatus] = useState("");
  async function submit() { try { setStatus("Saving…"); if (editing && onRename) await onRename(editing.id, name); else await onAdd(name); setName(""); setEditing(null); setStatus("Saved"); } catch { setStatus("Couldn’t save task. Try again."); } }
  return <SwipeDownSheet backdropStyle={styles.projectSheetBackdrop} onClose={onClose} sheetStyle={styles.projectSheet} testID="task-picker-sheet">
    <View style={styles.projectSheetContent}><Text style={styles.heading}>{manage ? "Project tasks" : "Choose task"}</Text>
      {tasks.map((task) => <Pressable key={task.id} onLongPress={manage && onRename ? () => { setEditing(task); setName(task.name); } : undefined} onPress={() => onSelect?.(task.id)} style={styles.dropdownOption}><Text style={styles.body}>{task.id === selectedId ? `Selected: ${task.name}` : task.name}</Text></Pressable>)}
      <TextInput accessibilityLabel="Task name" onChangeText={setName} placeholder="Task name" placeholderTextColor={theme.colors.placeholder} style={styles.textInput} value={name} />
      <Pressable disabled={!name.trim()} onPress={() => void submit()} style={[styles.actionButtonSecondary, !name.trim() && styles.disabledButton]}><Text style={[styles.actionButtonSecondaryText, !name.trim() && styles.disabledButtonText]}>{editing ? "Rename task" : "+ Add task"}</Text></Pressable>
      {manage && onRename ? <Text style={styles.muted}>Press and hold a task to rename it.</Text> : null}{status ? <Text accessibilityLiveRegion="polite" style={styles.muted}>{status}</Text> : null}
    </View>
  </SwipeDownSheet>;
}
