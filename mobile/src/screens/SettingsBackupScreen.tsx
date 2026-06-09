import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { exportBackupJson, importBackupJson } from "../backup/backupService";
import { getLocalRepositories } from "../db/repositories";
import { backupWarning } from "../screenContent";
import { styles } from "../styles";

export function SettingsBackupScreen() {
  const [backupJson, setBackupJson] = useState<string | null>(null);
  const [status, setStatus] = useState(
    "Document picker arrives in a later phase. This screen uses in-memory JSON so the backup service can be tested now.",
  );

  async function handleExport() {
    try {
      const repositories = await getLocalRepositories();
      const json = await exportBackupJson(repositories.backup);
      setBackupJson(json);
      setStatus("JSON backup created in memory for this mobile slice.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleImport() {
    if (!backupJson) {
      setStatus("Export a JSON backup first, then use Import JSON Backup to restore it in memory.");
      return;
    }

    try {
      const repositories = await getLocalRepositories();
      const result = await importBackupJson(backupJson, repositories.backup, {
        mode: "overwrite",
      });
      const tableCount = Object.keys(result.importedTableCounts).length;
      setStatus(`JSON backup restored in overwrite mode across ${tableCount} tables.`);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  return (
    <>
      <View style={[styles.card, styles.warningCard]}>
        <Text style={styles.eyebrow}>Backup warning</Text>
        <Text style={styles.body}>{backupWarning}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Backup tools</Text>
        <Text style={styles.body}>
          Export creates a ClaimProof SG JSON backup from local SQLite. Import
          restores the current in-memory backup with explicit overwrite mode.
        </Text>
        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={handleExport}>
            <Text style={styles.actionButtonText}>Export JSON Backup</Text>
          </Pressable>
          <Pressable style={styles.actionButtonSecondary} onPress={handleImport}>
            <Text style={styles.actionButtonSecondaryText}>Import JSON Backup</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>{status}</Text>
        {backupJson ? (
          <Text style={styles.codePreview} numberOfLines={6}>
            {backupJson}
          </Text>
        ) : null}
      </View>
    </>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Backup action failed.";
}
