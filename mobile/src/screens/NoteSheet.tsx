import { useState } from "react";
import { Pressable, Text, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScroll } from "../components/KeyboardAwareScroll";
import { SwipeDownSheet } from "../components/SwipeDownSheet";
import { styles, theme } from "../styles";

export function NoteSheet({ initialValue, readOnly, onClose, onSave }: { initialValue: string; readOnly: boolean; onClose: () => void; onSave: (note: string) => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState(initialValue);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() { setSaving(true); setStatus("Saving…"); try { await onSave(note); setStatus("Saved"); } catch { setStatus("Couldn’t save note. Try again."); } finally { setSaving(false); } }
  return <SwipeDownSheet backdropStyle={styles.projectSheetBackdrop} onClose={onClose} sheetStyle={styles.projectSheet} testID="shift-note-sheet">
    <KeyboardAwareScroll bottomPadding={Math.max(insets.bottom, 24)} contentContainerStyle={styles.projectSheetContent} fill={false}>
      <Text style={styles.heading}>Shift note</Text>
      <TextInput accessibilityLabel="Shift note" editable={!readOnly && !saving} multiline onChangeText={setNote} placeholder="Add evidence or work details" placeholderTextColor={theme.colors.placeholder} style={[styles.textInput, styles.textArea]} value={note} />
      {status ? <Text accessibilityLiveRegion="polite" style={styles.muted}>{status}</Text> : null}
      {!readOnly ? <Pressable disabled={saving} onPress={() => void save()} style={[styles.actionButton, saving && styles.disabledButton]}><Text style={[styles.actionButtonText, saving && styles.disabledButtonText]}>Save note</Text></Pressable> : <Text style={styles.muted}>This note is read-only after clock-out.</Text>}
    </KeyboardAwareScroll>
  </SwipeDownSheet>;
}
