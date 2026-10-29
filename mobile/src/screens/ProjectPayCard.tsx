import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { AppSettings } from "../db/settingsValidation";
import { styles, theme } from "../styles";
export function ProjectPayCard({ name, settings, rateCents, onSave }: { name: string; settings: AppSettings; rateCents: number; onSave: (name: string, rate: string, settings: AppSettings) => Promise<void> }) {
  const [reportName, setReportName] = useState(name);
  const [rate, setRate] = useState(rateCents > 0 ? (rateCents / 100).toFixed(2) : "");
  const [values, setValues] = useState(settings);
  const [multipliers, setMultipliers] = useState({
    overtimeMultiplier: String(settings.overtimeMultiplier),
    offDayMultiplier: String(settings.offDayMultiplier),
    holidayMultiplier: String(settings.holidayMultiplier),
  });
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() { setBusy(true); try { await onSave(reportName, rate, {
      ...values,
      overtimeMultiplier: Number(multipliers.overtimeMultiplier),
      offDayMultiplier: Number(multipliers.offDayMultiplier),
      holidayMultiplier: Number(multipliers.holidayMultiplier),
    }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save pay."); } finally { setBusy(false); } }
  return <View style={styles.card}>
    <Text style={styles.heading}>Pay</Text>
    <Text style={styles.inputLabel}>Your name for the report</Text>
    <TextInput accessibilityLabel="Your name for the report" value={reportName} onChangeText={setReportName} style={styles.textInput} />
    <Text style={styles.inputLabel}>Hourly rate SGD</Text>
    <TextInput accessibilityLabel="Hourly rate SGD" keyboardType="decimal-pad" value={rate} onChangeText={setRate} style={styles.textInput} />
    {(["normalWorkStartTime", "normalWorkEndTime"] as const).map((key) => <View key={key}>
      <Text style={styles.inputLabel}>{key === "normalWorkStartTime" ? "Normal start" : "Normal end"}</Text>
      <TextInput value={values[key]} onChangeText={(text) => setValues({ ...values, [key]: text })} placeholder="HH:mm" placeholderTextColor={theme.colors.placeholder} style={styles.textInput} />
    </View>)}
    <Pressable onPress={() => setAdvanced(!advanced)}>
      <Text style={styles.body}>Advanced {advanced ? "▲" : "▼"}</Text>
    </Pressable>
    {advanced ? <View>
      <Text style={styles.muted}>Defaults only, not legal advice. Check your contract.</Text>{(["overtimeMultiplier", "offDayMultiplier", "holidayMultiplier"] as const).map((key) => <View key={key}>
        <Text style={styles.inputLabel}>{key === "overtimeMultiplier" ? "Overtime multiplier" : key === "offDayMultiplier" ? "Off day multiplier" : "Holiday multiplier"}</Text>
        <TextInput keyboardType="decimal-pad" value={multipliers[key]} onChangeText={(text) => setMultipliers({ ...multipliers, [key]: text })} style={styles.textInput} />
      </View>)}</View> : null}
    {error ? <Text style={styles.body}>{error}</Text> : null}
    <Pressable disabled={busy} onPress={() => void save()} style={[styles.actionButton, busy && styles.disabledButton]}>
      <Text style={styles.actionButtonText}>Save &amp; continue</Text>
    </Pressable>
  </View>;
}
