import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Image, Platform, Pressable, Text, TextInput, View } from "react-native";

import {
  buildEvidencePhotoPath,
  deleteEvidencePhotoFile,
  importEvidencePhotoFile,
} from "../photos/photoFileStorage";
import { getOptionalPhotoGps } from "../photos/photoGps";
import type { PhotoEvidenceRow } from "../photos/photoEvidenceRepository";
import { type PhotoEvidenceType, type PhotoGpsResult } from "../photos/photoEvidenceTypes";
import { photoEvidenceContent } from "../screenContent";
import { styles } from "../styles";
import type { WorkProject } from "../work/workRepository";

const LOCAL_USER_ID = "local-user";
type PhotoAction = "camera" | "gallery";
const SIMPLE_EVIDENCE_TYPES: PhotoEvidenceType[] = [
  "DURING_WORK",
  "COMPLETED_WORK",
  "DEFECT",
  "OTHER",
];
const WEB_PHOTO_STORAGE_KEY = "dispute-web-saved-photo-evidence";

export function PhotoEvidenceScreen() {
  const [status, setStatus] = useState(photoEvidenceContent.localStorageBody);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [caption, setCaption] = useState("");
  const [evidenceType, setEvidenceType] = useState<PhotoEvidenceType>("DURING_WORK");
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingCapturedAt, setPendingCapturedAt] = useState<string | null>(null);
  const [pendingGps, setPendingGps] = useState<PhotoGpsResult | null>(null);
  const [rows, setRows] = useState<PhotoEvidenceRow[]>([]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    if (Platform.OS === "web") {
      const { webWorkStore } = await import("../work/webWorkStore");
      const nextProjects = await webWorkStore.listProjects();
      setProjects(nextProjects);
      setProjectId((current) => current || nextProjects[0]?.id || "");
      setRows(readWebPhotoEvidenceRows());
      return;
    }
    try {
      const repositories = await getNativeRepositories();
      const [nextProjects, nextRows] = await Promise.all([
        repositories.work.listProjects(),
        repositories.photoEvidence.listRecentPhotoEvidence({ userId: LOCAL_USER_ID }),
      ]);
      setProjects(nextProjects);
      setProjectId((current) => current || nextProjects[0]?.id || "");
      setRows(nextRows);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handlePhotoAction(action: PhotoAction) {
    try {
      if (!projectId) throw new Error("Choose a project before adding evidence.");
      const permission = action === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatus(photoEvidenceContent.permissionDenied);
        return;
      }
      const result = action === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
      if (result.canceled || result.assets.length === 0) {
        setStatus("No photo selected. Nothing was saved.");
        return;
      }
      const selected = result.assets[0];
      const capturedAt = new Date();
      const photoId = `photo-${capturedAt.getTime()}`;
      const destinationUri = buildEvidencePhotoPath({
        userId: LOCAL_USER_ID,
        projectId,
        photoId,
        timestamp: capturedAt,
        extension: getExtension(selected.uri),
      });
      const imported = await importEvidencePhotoFile({ sourceUri: selected.uri, destinationUri });
      const gps = await getOptionalPhotoGps();
      setPendingId(photoId);
      setPendingUri(imported.localUri);
      setPendingCapturedAt(capturedAt.toISOString());
      setPendingGps(gps);
      setStatus(`${imported.message} Review the details, then save evidence. ${gps.message}`);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleSave() {
    if (!projectId) {
      setStatus("Create a project before saving evidence.");
      return;
    }
    if (!pendingUri || !pendingId) {
      setStatus("Take a photo or choose one from the gallery first.");
      return;
    }
    if (Platform.OS === "web") {
      const row = buildWebPhotoEvidenceRow({
        id: pendingId,
        projectId,
        localUri: pendingUri,
        caption,
        evidenceType,
        gps: pendingGps,
      });
      const nextRows = [row, ...readWebPhotoEvidenceRows()].slice(0, 20);
      writeWebPhotoEvidenceRows(nextRows);
      setRows(nextRows);
      setPendingUri(null);
      setPendingId(null);
      setPendingCapturedAt(null);
      setPendingGps(null);
      setCaption("");
      setStatus("Photo evidence saved in this phone preview. Device app builds save into local SQLite.");
      return;
    }
    try {
      const repositories = await getNativeRepositories();
      await repositories.photoEvidence.insertPhotoEvidence({
        id: pendingId,
        userId: LOCAL_USER_ID,
        projectId,
        localUri: pendingUri,
        caption,
        evidenceType,
        gps: pendingGps,
        timestamp: pendingCapturedAt ?? undefined,
        status: "finalized",
      });
      setPendingUri(null);
      setPendingId(null);
      setPendingCapturedAt(null);
      setPendingGps(null);
      setCaption("");
      setStatus("Photo evidence saved locally and is ready for progress claims.");
      await refresh();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleDelete(row: PhotoEvidenceRow) {
    try {
      if (Platform.OS === "web") {
        const nextRows = readWebPhotoEvidenceRows().filter((item) => item.id !== row.id);
        writeWebPhotoEvidenceRows(nextRows);
        setRows(nextRows);
        setStatus("Saved photo removed from this phone preview.");
        return;
      }
      const repositories = await getNativeRepositories();
      await repositories.photoEvidence.deletePhotoEvidence({ id: row.id, userId: LOCAL_USER_ID });
      const fileResult = await deleteEvidencePhotoFile(row.local_uri);
      setStatus(`Evidence row deleted. ${fileResult.message}`);
      await refresh();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Evidence</Text>
        <Text style={styles.heading}>Add photo proof</Text>
        <Text style={styles.muted}>Shoot, describe, save.</Text>
        <Text style={styles.inputLabel}>Project</Text>
        <View style={styles.actionRow}>
          {projects.length ? projects.map((project) => (
            <Pressable key={project.id} onPress={() => setProjectId(project.id)} style={project.id === projectId ? styles.actionButton : styles.actionButtonSecondary}>
              <Text style={project.id === projectId ? styles.actionButtonText : styles.actionButtonSecondaryText}>{project.name}</Text>
            </Pressable>
          )) : (
            <Text style={styles.muted}>No project yet. Create one on the Time page first.</Text>
          )}
        </View>
        <Text style={styles.inputLabel}>Type</Text>
        <View style={styles.chipRow}>
          {SIMPLE_EVIDENCE_TYPES.map((type) => (
            <Pressable key={type} onPress={() => setEvidenceType(type)} style={type === evidenceType ? styles.chipActive : styles.chip}>
              <Text style={type === evidenceType ? styles.chipActiveText : styles.chipText}>{formatEvidenceType(type)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.inputLabel}>Note</Text>
        <TextInput accessibilityLabel="Photo evidence caption" multiline onChangeText={setCaption} placeholder="What does this photo prove?" style={[styles.textInput, styles.textArea]} value={caption} />
        <View style={styles.clockButtonRow}>
          <Pressable
            accessibilityState={{ disabled: !projectId }}
            disabled={!projectId}
            onPress={() => void handlePhotoAction("camera")}
            style={[styles.actionButton, !projectId && styles.disabledButton]}
          >
            <Text style={styles.actionButtonText}>Take photo</Text>
          </Pressable>
          <Pressable
            accessibilityState={{ disabled: !projectId }}
            disabled={!projectId}
            onPress={() => void handlePhotoAction("gallery")}
            style={[styles.actionButtonSecondary, !projectId && styles.disabledButton]}
          >
            <Text style={styles.actionButtonSecondaryText}>Gallery</Text>
          </Pressable>
        </View>
        {pendingUri ? (
          <View style={styles.previewPanel}>
            <Text style={styles.inputLabel}>Preview before saving</Text>
            <Image accessibilityLabel="Selected evidence preview" source={{ uri: pendingUri }} style={styles.evidencePreviewImage} />
            <Pressable accessibilityRole="button" onPress={() => void handleSave()} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Save Evidence</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.previewPanel}>
            <Text style={styles.muted}>Take a photo or choose from Gallery. The Save Evidence button appears after a photo is selected.</Text>
          </View>
        )}
        <Text style={styles.muted}>{status}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Saved photos</Text>
        {rows.length ? rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <Image source={{ uri: row.local_uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
            <View style={{ flex: 1, gap: 4 }}><Text style={styles.rowLabel}>{formatEvidenceType(row.evidence_type)}</Text><Text style={styles.body}>{row.caption || "No caption"}</Text><Text style={styles.muted}>{new Date(row.captured_at).toLocaleString()}</Text></View>
            <Pressable onPress={() => void handleDelete(row)} style={styles.statusPill}><Text style={styles.statusPillText}>Delete</Text></Pressable>
          </View>
        )) : <Text style={styles.muted}>No photo evidence saved on this device yet.</Text>}
      </View>
    </>
  );
}

function getExtension(uri: string): string {
  const extension = (uri.split("?")[0] ?? uri).split(".").pop();
  return extension && extension.length <= 5 ? extension : "jpg";
}

function formatEvidenceType(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Photo evidence action failed.";
}

async function getNativeRepositories() {
  const { getLocalRepositories } = await import("../db/repositories");
  return getLocalRepositories();
}

function buildWebPhotoEvidenceRow(params: {
  id: string;
  projectId: string;
  localUri: string;
  caption: string;
  evidenceType: PhotoEvidenceType;
  gps: PhotoGpsResult | null;
}): PhotoEvidenceRow {
  return {
    id: params.id,
    user_id: LOCAL_USER_ID,
    project_id: params.projectId,
    time_entry_id: null,
    local_uri: params.localUri,
    caption: params.caption.trim() || null,
    evidence_type: params.evidenceType,
    captured_at: new Date().toISOString(),
    gps_latitude: params.gps?.coordinates?.latitude ?? null,
    gps_longitude: params.gps?.coordinates?.longitude ?? null,
    gps_message: params.gps?.message ?? null,
    status: "finalized",
  };
}

function readWebPhotoEvidenceRows(): PhotoEvidenceRow[] {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return [];
    }
    const parsed = JSON.parse(storage.getItem(WEB_PHOTO_STORAGE_KEY) ?? "[]") as PhotoEvidenceRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWebPhotoEvidenceRows(rows: PhotoEvidenceRow[]): void {
  try {
    globalThis.localStorage?.setItem(WEB_PHOTO_STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // Preview storage failure should not block the native evidence path.
  }
}
