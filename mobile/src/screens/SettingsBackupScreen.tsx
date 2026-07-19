import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { exportBackupJson, importBackupJson } from "../backup/backupService";
import { pickBackupFile, shareBackupFile, writeBackupFile } from "../backup/backupFiles";
import { backupWarning } from "../screenContent";
import { styles } from "../styles";

export function SettingsBackupScreen() {
  const [backupJson, setBackupJson] = useState<string | null>(null);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [restoreArmed, setRestoreArmed] = useState(false);
  const [status, setStatus] = useState(
    "Export a durable JSON backup before changing phone, clearing app data, or uninstalling.",
  );

  async function handleExport() {
    try {
      const repositories = await getNativeRepositories();
      const json = await exportBackupJson(repositories.backup);
      const file = await writeBackupFile(json);
      setBackupJson(json);
      setBackupPath(file.filePath);
      setStatus(`${file.message} Use Share Backup to copy it off this device.`);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleChooseImport() {
    try {
      const picked = await pickBackupFile();
      if (picked.canceled || !picked.json) {
        setStatus("Backup selection cancelled. Local records were not changed.");
        return;
      }
      setBackupJson(picked.json);
      setRestoreArmed(true);
      setStatus(`Selected ${picked.fileName ?? "backup file"}. Tap Confirm Overwrite Restore to replace local records.`);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleImport() {
    if (!backupJson || !restoreArmed) {
      setStatus("Choose a valid backup file before confirming restore.");
      return;
    }

    try {
      const repositories = await getNativeRepositories();
      const result = await importBackupJson(backupJson, repositories.backup, {
        mode: "overwrite",
      });
      const tableCount = Object.keys(result.importedTableCounts).length;
      setStatus(`JSON backup restored in overwrite mode across ${tableCount} tables.`);
      setRestoreArmed(false);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleShare() {
    if (!backupPath) {
      setStatus("Export a backup before opening the share sheet.");
      return;
    }
    try {
      setStatus(await shareBackupFile(backupPath));
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
          Export creates a dispute JSON backup from local SQLite. Import
          validates a selected JSON file and restores it only after explicit overwrite confirmation.
        </Text>
        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={handleExport}>
            <Text style={styles.actionButtonText}>Export JSON Backup</Text>
          </Pressable>
          <Pressable style={styles.actionButtonSecondary} onPress={handleShare}>
            <Text style={styles.actionButtonSecondaryText}>Share Backup</Text>
          </Pressable>
          <Pressable style={styles.actionButtonSecondary} onPress={handleChooseImport}>
            <Text style={styles.actionButtonSecondaryText}>Choose Backup File</Text>
          </Pressable>
        </View>
        {restoreArmed ? (
          <Pressable style={styles.actionButton} onPress={handleImport}>
            <Text style={styles.actionButtonText}>Confirm Overwrite Restore</Text>
          </Pressable>
        ) : null}
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

async function getNativeRepositories() {
  const { getLocalRepositories } = await import("../db/repositories");
  return getLocalRepositories();
}
