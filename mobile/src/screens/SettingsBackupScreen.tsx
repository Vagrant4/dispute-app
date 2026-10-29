import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { exportBackupJson, importBackupJson } from "../backup/backupService";
import { pickBackupFile, shareBackupFile, writeBackupFile } from "../backup/backupFiles";
import { backupWarning } from "../screenContent";
import { styles } from "../styles";
import type { LocalAccount } from "../auth/localAuth";

type SettingsBackupScreenProps = {
  account: LocalAccount;
  exportOnly?: boolean;
};

export function SettingsBackupScreen({ account, exportOnly = false }: SettingsBackupScreenProps) {
  const userId = account.id ?? account.email.trim().toLowerCase();
  const [backupJson, setBackupJson] = useState<string | null>(null);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [restoreArmed, setRestoreArmed] = useState(false);
  const [status, setStatus] = useState(
    "Save a copy before changing phone.",
  );

  async function handleExport() {
    try {
      const repositories = await getNativeRepositories(userId);
      const json = await exportBackupJson(repositories.backup, userId);
      const file = await writeBackupFile(json, userId);
      setBackupJson(json);
      setBackupPath(file.filePath);
      setStatus("Copy saved. Use Send a copy to keep it somewhere else.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleChooseImport() {
    if (exportOnly) {
      setStatus("Restore is unavailable in read-only mode. Export and share remain available.");
      return;
    }
    try {
      const picked = await pickBackupFile();
      if (picked.canceled || !picked.json) {
        setStatus("Nothing was changed.");
        return;
      }
      setBackupJson(picked.json);
      setRestoreArmed(true);
      setStatus("Tap Confirm restore to replace what's on this phone.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleImport() {
    if (exportOnly) {
      setStatus("Restore is unavailable in read-only mode. Existing records were not changed.");
      return;
    }
    if (!backupJson || !restoreArmed) {
      setStatus("Choose a valid backup file before confirming restore.");
      return;
    }

    try {
      const repositories = await getNativeRepositories(userId);
      await importBackupJson(backupJson, repositories.backup, {
        mode: "overwrite",
        userId,
      });
      setStatus("Your records were restored.");
      setRestoreArmed(false);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleShare() {
    if (!backupPath) {
      setStatus("Save a copy first.");
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
      <View style={styles.settingsSection}>
        <Text style={styles.todayTitle}>Keep a copy</Text>
        <Text style={styles.body}>{backupWarning}</Text>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.rowLabel}>Your records</Text>
        <Text style={styles.body}>
          Save a copy of your records. {exportOnly
            ? "Read-only mode keeps export and share available without changing records."
            : "Restoring replaces what's on this phone. We'll ask first."}
        </Text>
        <View style={styles.actionRow}>
          <Pressable style={styles.actionButtonSecondary} onPress={handleExport}>
            <Text style={styles.actionButtonSecondaryText}>Save a copy</Text>
          </Pressable>
          <Pressable style={styles.actionButtonSecondary} onPress={handleShare}>
            <Text style={styles.actionButtonSecondaryText}>Send a copy</Text>
          </Pressable>
          {!exportOnly ? (
            <Pressable style={styles.actionButtonSecondary} onPress={handleChooseImport}>
              <Text style={styles.actionButtonSecondaryText}>Restore from a copy</Text>
            </Pressable>
          ) : null}
        </View>
        {restoreArmed && !exportOnly ? (
          <Pressable style={styles.actionButtonSecondary} onPress={handleImport}>
            <Text style={styles.actionButtonSecondaryText}>Confirm restore</Text>
          </Pressable>
        ) : null}
        <Text style={styles.muted}>{status}</Text>
      </View>
    </>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "This file isn't a DISPUTE copy.") return error.message;
  return "Something went wrong. Please try again.";
}

async function getNativeRepositories(userId: string) {
  const { getLocalRepositories } = await import("../db/repositories");
  return getLocalRepositories(userId);
}
