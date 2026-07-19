import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export type BackupFileResult = {
  filePath: string;
  message: string;
};

export async function writeBackupFile(json: string): Promise<BackupFileResult> {
  if (!FileSystem.documentDirectory) {
    throw new Error("Durable app storage is unavailable on this device.");
  }
  const directory = `${FileSystem.documentDirectory}backups/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = `${directory}dispute-backup-${stamp}.json`;
  await FileSystem.writeAsStringAsync(filePath, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const info = await FileSystem.getInfoAsync(filePath);
  if (!info.exists || !("size" in info) || (info.size ?? 0) <= 0) {
    throw new Error("Backup file could not be verified after writing.");
  }
  return { filePath, message: "Backup saved in dispute local storage." };
}

export async function shareBackupFile(filePath: string): Promise<string> {
  if (!(await Sharing.isAvailableAsync())) {
    return `Native sharing is unavailable. Backup remains at ${filePath}`;
  }
  await Sharing.shareAsync(filePath, {
    mimeType: "application/json",
    dialogTitle: "Export dispute backup",
    UTI: "public.json",
  });
  return "Backup share sheet opened.";
}

export async function pickBackupFile(): Promise<{
  canceled: boolean;
  fileName?: string;
  json?: string;
}> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) {
    return { canceled: true };
  }
  const asset = result.assets[0];
  const json = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return { canceled: false, fileName: asset.name, json };
}
