import * as ImagePicker from "expo-image-picker";
import { MaterialIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import { Alert, Image, Platform, Pressable, ScrollView, SectionList, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  buildEvidencePhotoPath,
  deleteEvidencePhotoFile,
  importEvidencePhotoFile,
} from "../photos/photoFileStorage";
import { getOptionalPhotoGps } from "../photos/photoGps";
import type { PhotoEvidenceRow } from "../photos/photoEvidenceRepository";
import { type PhotoEvidenceType, type PhotoGpsResult } from "../photos/photoEvidenceTypes";
import { photoEvidenceContent } from "../screenContent";
import { photoCaptureMetadata, photoSealBadge, photoTimeLabel, sealPhoto } from "../photos/photoSeal";
import { projectPickerLabel } from "../work/projectLabels";
import { space, styles, theme } from "../styles";
import { useSubscriptionAccess } from "../subscription/useSubscriptionAccess";
import type { WorkProject } from "../work/workRepository";
import type { LocalAccount } from "../auth/localAuth";
import { KeyboardAwareScroll } from "../components/KeyboardAwareScroll";
import { SwipeDownSheet } from "../components/SwipeDownSheet";
import { ProjectNameSheet } from "./ProjectNameSheet";
import { getLocalRepositories } from "../db/repositories";

type PhotoAction = "camera" | "gallery";
const SIMPLE_EVIDENCE_TYPES: PhotoEvidenceType[] = [
  "DURING_WORK",
  "COMPLETED_WORK",
  "DEFECT",
  "OTHER",
];
const WEB_PHOTO_STORAGE_KEY = "dispute-web-saved-photo-evidence";

export function PhotoEvidenceScreen({ account, initialProjectId, projectScoped = false }: { account: LocalAccount; initialProjectId?: string; projectScoped?: boolean }) {
  const [iconsLoaded] = useFonts(MaterialIcons.font);
  const insets = useSafeAreaInsets();
  const access = useSubscriptionAccess(account);
  const userId = account.id ?? account.email.trim().toLowerCase();
  const [status, setStatus] = useState("");
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [caption, setCaption] = useState("");
  const [evidenceType, setEvidenceType] = useState<PhotoEvidenceType>("DURING_WORK");
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingCapturedAt, setPendingCapturedAt] = useState<string | null>(null);
  const [pendingGps, setPendingGps] = useState<PhotoGpsResult | null>(null);
  const [captureSheetOpen, setCaptureSheetOpen] = useState(false);
  const [detail, setDetail] = useState<PhotoEvidenceRow | null>(null);
  const [filterProjectId, setFilterProjectId] = useState(initialProjectId ?? "");
  const [captureSource, setCaptureSource] = useState<PhotoAction>("camera");
  const [captureTimeSource, setCaptureTimeSource] = useState<"device_clock" | "exif" | "unknown">("device_clock");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  const [rows, setRows] = useState<PhotoEvidenceRow[]>([]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    if (Platform.OS === "web") {
      const { webWorkStore } = await import("../work/webWorkStore");
      const nextProjects = await webWorkStore.listProjects(userId);
      setProjects(nextProjects);
      const home = await webWorkStore.getHomeState(userId);
      setProjectId((current) => home.activeEntry?.projectId || current || readWebPhotoEvidenceRows(userId)[0]?.project_id || home.recentEntries[0]?.projectId || nextProjects[0]?.id || "");
      setRows(readWebPhotoEvidenceRows(userId));
      return;
    }
    try {
      const repositories = await getNativeRepositories(userId);
      const [nextProjects, nextRows] = await Promise.all([
        repositories.work.listProjects(userId),
        repositories.photoEvidence.listRecentPhotoEvidence({ userId }),
      ]);
      setProjects(nextProjects);
      const home = await repositories.work.getHomeState(userId);
      setProjectId((current) => home.activeEntry?.projectId || current || nextRows[0]?.project_id || home.recentEntries[0]?.projectId || nextProjects[0]?.id || "");
      setRows(nextRows);
    } catch (error) {
      setStatus(getErrorMessage(error, "load the photos"));
    }
  }

  async function handlePhotoAction(action: PhotoAction) {
    let failureCode: "PHOTO_CAMERA_FAILED" | "PHOTO_IMPORT_FAILED" = "PHOTO_CAMERA_FAILED";
    try {
      if (!access.hasCurrentCreateAccess()) throw new Error("An active trial or subscription is required to capture new evidence.");
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
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.85, exif: true });
      if (result.canceled || result.assets.length === 0) {
        setStatus("");
        return;
      }
      const selected = result.assets[0];
      const capturedAt = new Date();
      const metadata = photoCaptureMetadata(action, selected.exif, capturedAt.toISOString());
      const photoId = `photo-${capturedAt.getTime()}`;
      const destinationUri = buildEvidencePhotoPath({
        userId,
        projectId,
        photoId,
        timestamp: capturedAt,
        extension: getExtension(selected.uri),
      });
      failureCode = "PHOTO_IMPORT_FAILED";
      const imported = await importEvidencePhotoFile({ sourceUri: selected.uri, destinationUri });
      setPendingId(photoId);
      setPendingUri(imported.localUri);
      setPendingCapturedAt(metadata.capturedAt);
      setCaptureSource(metadata.captureSource);
      setCaptureTimeSource(metadata.captureTimeSource);
      setEvidenceType("DURING_WORK");
      setCaption("");
      setSaveFailed(false);
      setCaptureSheetOpen(true);
      setStatus("");
      const gps: PhotoGpsResult = action === "camera"
        ? await getOptionalPhotoGps()
        : { coordinates: null, message: "Gallery import: no GPS attached", blocked: false };
      setPendingGps(gps);
    } catch (error) {
      console.warn("[DISPUTE photo] failed", { code: failureCode });
      setStatus(getErrorMessage(error, "open the camera"));
      setCaptureSheetOpen(false);
    }
  }

  async function handleSave() {
    if (!access.hasCurrentCreateAccess()) {
      setStatus("Existing evidence remains readable. Subscribe to save new evidence.");
      return;
    }
    if (!projectId) {
      setStatus("Create a project before saving evidence.");
      return;
    }
    if (!pendingUri || !pendingId) {
      setStatus("Take a photo or choose one from the gallery first.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      let seal: Awaited<ReturnType<typeof sealPhoto>>;
      try {
        seal = await sealPhoto({ localUri: pendingUri, capturedAt: pendingCapturedAt, gps: pendingGps });
      } catch {
        console.warn("[DISPUTE photo] failed", { code: "PHOTO_SEAL_FAILED" });
        throw new Error("PHOTO_SEAL_FAILED");
      }
      if (Platform.OS === "web") {
        const row = buildWebPhotoEvidenceRow({ userId, id: pendingId, projectId, localUri: pendingUri, caption, evidenceType, gps: pendingGps, capturedAt: pendingCapturedAt, captureSource, captureTimeSource, ...seal });
        const nextRows = [row, ...readWebPhotoEvidenceRows(userId)];
        writeWebPhotoEvidenceRows(nextRows, userId);
        setRows(nextRows);
      } else {
        const repositories = await getNativeRepositories(userId);
        try {
          await repositories.photoEvidence.insertPhotoEvidence({ id: pendingId, userId, projectId, localUri: pendingUri, caption, evidenceType, gps: pendingGps, timestamp: pendingCapturedAt, captureSource, captureTimeSource, ...seal, status: "finalized" });
        } catch {
          console.warn("[DISPUTE photo] failed", { code: "PHOTO_DB_INSERT_FAILED" });
          throw new Error("PHOTO_DB_INSERT_FAILED");
        }
        await refresh();
      }
      setPendingUri(null);
      setPendingId(null);
      setPendingCapturedAt(null);
      setPendingGps(null);
      setCaption("");
      setStatus("Photo saved.");
      setSaveFailed(false);
      setCaptureSheetOpen(false);
      console.info("[DISPUTE photo] saved", { code: "PHOTO_SAVED" });
    } catch (error) {
      setSaveFailed(true);
      setStatus("Couldn't save this photo. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: PhotoEvidenceRow) {
    try {
      if (!access.hasCurrentCreateAccess()) throw new Error("Expired access is read-only. Existing evidence cannot be changed.");
      setDetail(null);
      if (Platform.OS === "web") {
        const nextRows = readWebPhotoEvidenceRows(userId).filter((item) => item.id !== row.id);
        writeWebPhotoEvidenceRows(nextRows, userId);
        setRows(nextRows);
        setStatus("Photo deleted.");
        return;
      }
      const repositories = await getNativeRepositories(userId);
      await repositories.photoEvidence.deletePhotoEvidence({ id: row.id, userId });
      await deleteEvidencePhotoFile(row.local_uri);
      setStatus("Photo deleted.");
      await refresh();
    } catch (error) {
      setStatus(getErrorMessage(error, "delete the photo"));
    }
  }

  const groups = groupPhotos(rows.filter((row) => !filterProjectId || row.project_id === filterProjectId));
  const headerProject = projects.find((project) => project.id === (filterProjectId || projectId));
  const canCapture = !!projectId && access.canCreateRecords;
  function confirmDelete(row: PhotoEvidenceRow) {
    if (Platform.OS === "web") {
      if (globalThis.confirm("Remove this photo? The photo will be removed and an audit entry kept.")) void handleDelete(row);
    } else Alert.alert("Remove this photo?", "The photo will be removed and an audit entry kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void handleDelete(row) },
    ]);
  }
  return (
    <View style={[styles.photosPage, projectScoped && styles.projectPhotos]}>
      {!projectScoped ? <View style={styles.photoProjectHeader}><Text style={styles.todayTitle}>{headerProject?.name ?? "Photos"}</Text>{headerProject?.siteAddress ? <Text style={styles.muted}>{headerProject.siteAddress}</Text> : null}<Text style={styles.photoProofLabel}>Sealed on this phone</Text></View> : null}
      {!access.canCreateRecords ? <Text style={styles.muted}>{access.message}</Text> : null}
      {!projectScoped ? <ScrollView horizontal style={styles.photoFilterScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoFilters}>
        {[{ id: "", name: "All" }, ...projects].map((project) => <Pressable accessibilityRole="button" accessibilityState={{ selected: filterProjectId === project.id }} key={project.id} onPress={() => setFilterProjectId(project.id)} style={filterProjectId === project.id ? styles.chipSelected : styles.chip}><Text style={filterProjectId === project.id ? styles.selectedSecondaryText : styles.chipText}>{project.id ? projectPickerLabel(project, projects) : project.name}</Text></Pressable>)}
      </ScrollView> : null}
      {rows.length === 0 ? <ScrollView contentContainerStyle={styles.photoEmpty}>
        <Text style={styles.photoEmptyIcon}>▧</Text>
        <Text style={styles.heading}>No photos yet</Text>
        <Text style={styles.muted}>Photos you take are sealed with time and GPS on this phone.</Text>

      </ScrollView> : <>
        <SectionList style={styles.photoList} scrollEnabled stickySectionHeadersEnabled sections={groups} keyExtractor={(pair) => pair[0].id}
          renderSectionHeader={({ section }) => <View style={styles.photoDayHeader}><Text style={styles.inputLabel}>{section.title}</Text></View>}
          renderItem={({ item }) => <View>
            {!projectScoped && item[0].id === groups.flatMap((group) => group.data).find((pair) => pair[0].project_id === item[0].project_id && photoDay(pair[0]) === photoDay(item[0]))?.[0].id ? <Text style={styles.photoProjectLabel}>{projects.find((project) => project.id === item[0].project_id)?.name ?? "Project"}</Text> : null}
            <View style={styles.photoGridRow}>{item.map((row) => <View key={row.id} style={styles.photoTile}><Pressable accessibilityRole="button" accessibilityLabel={`Open photo: ${photoTimeLabel(row)}`} onPress={() => setDetail(row)}>
              <Image source={{ uri: row.local_uri }} style={styles.photoTileImage} />
              <Text style={styles.photoBadge}>{photoSealBadge(row)}</Text>
              <View style={styles.photoOverlay}><Text style={styles.photoOverlayText}>{photoTimeLabel(row)} · {formatEvidenceType(row.evidence_type)}</Text><Text style={styles.photoOverlayText}>{photoAddress(row)}</Text></View>
            </Pressable><Pressable accessibilityLabel="Delete photo" accessibilityRole="button" onPress={() => confirmDelete(row)} style={styles.photoDeleteButton}><Text style={styles.body}>🗑</Text></Pressable></View>)}</View>
          </View>} ListEmptyComponent={<Text style={styles.muted}>No photos for this project yet.</Text>} />

      </>}
        <Pressable accessibilityLabel="Take photo" accessibilityRole="button" disabled={!canCapture || !iconsLoaded} onPress={() => void handlePhotoAction("camera")} onLongPress={() => setCaptureSheetOpen(true)} style={[styles.photoFab, { bottom: Math.max(insets.bottom, space.md) }, (!canCapture || !iconsLoaded) && styles.disabledButton]}><MaterialIcons testID="camera-fab-glyph" name="photo-camera" size={28} color={theme.colors.ink} /></Pressable>
      {!projectId ? <View><Text style={styles.muted}>Add a project before saving photo evidence.</Text><Pressable accessibilityRole="button" onPress={() => setProjectSheetOpen(true)} style={styles.textButton}><Text style={styles.body}>+ Add project</Text></Pressable></View> : null}
      {status ? <Text style={styles.muted}>{status}</Text> : null}
      <SwipeDownSheet visible={captureSheetOpen} backdropStyle={styles.photoSheetBackdrop} sheetStyle={styles.photoSheet} testID="photo-proof-sheet" onClose={() => { if (!saving) setCaptureSheetOpen(false); }}>
        <KeyboardAwareScroll contentContainerStyle={styles.photoSheetContent} bottomPadding={Math.max(insets.bottom, 24)}>
          <Text style={styles.heading}>Photo proof</Text>
          {pendingUri ? <Image accessibilityLabel="Selected evidence preview" source={{ uri: pendingUri }} style={styles.evidencePreviewImage} /> : null}
          <Text style={styles.muted}>{pendingUri ? photoTimeLabel({ captured_at: pendingCapturedAt, capture_source: captureSource, capture_time_source: captureTimeSource }) : "Choose a photo to save."}</Text>
          <Text style={styles.inputLabel}>Project</Text>
          <View style={styles.chipRow}>{projects.map((project) => <Pressable disabled={saving} key={project.id} onPress={() => setProjectId(project.id)} style={[project.id === projectId ? styles.chipSelected : styles.chip, (saving) && styles.disabledButton]}><Text style={[project.id === projectId ? styles.selectedSecondaryText : styles.chipText, (saving) && styles.disabledButtonText]}>{project.name}</Text></Pressable>)}</View>
          <View style={styles.chipRow}>{SIMPLE_EVIDENCE_TYPES.map((type) => <Pressable disabled={saving} key={type} onPress={() => setEvidenceType(type)} style={[type === evidenceType ? styles.chipSelected : styles.chip, (saving) && styles.disabledButton]}><Text style={[type === evidenceType ? styles.selectedSecondaryText : styles.chipText, (saving) && styles.disabledButtonText]}>{formatEvidenceType(type)}</Text></Pressable>)}</View>
          {captureSheetOpen ? <TextInput accessibilityLabel="Photo evidence caption" editable={!saving} multiline onChangeText={setCaption} placeholder="Optional note" placeholderTextColor={theme.colors.placeholder} style={[styles.textInput, styles.textArea]} value={caption} /> : null}
          <Pressable disabled={saving || !pendingUri || !canCapture} onPress={() => void handleSave()} style={[styles.actionButtonSecondary, (saving || !pendingUri || !canCapture) && styles.disabledButton]}><Text style={[styles.actionButtonSecondaryText, ((saving || !pendingUri || !canCapture)) && styles.disabledButtonText]}>{saving ? "Saving…" : "Save"}</Text></Pressable>
          {saveFailed ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => void handleSave()} style={[styles.actionButtonSecondary, saving && styles.disabledButton]}><Text style={[styles.actionButtonSecondaryText, saving && styles.disabledButtonText]}>Retry</Text></Pressable> : null}
          <Pressable disabled={saving} onPress={() => void handlePhotoAction("gallery")} style={[styles.actionButtonSecondary, (saving) && styles.disabledButton]}><Text style={[styles.actionButtonSecondaryText, (saving) && styles.disabledButtonText]}>Import from gallery</Text></Pressable>
          {status ? <Text style={styles.muted}>{status}</Text> : null}
          <Pressable style={[(saving) && styles.disabledButton]} disabled={saving} onPress={() => setCaptureSheetOpen(false)}><Text style={[styles.muted, (saving) && styles.disabledButtonText]}>Cancel</Text></Pressable>
        </KeyboardAwareScroll>
      </SwipeDownSheet>
      {projectSheetOpen ? <ProjectNameSheet onClose={() => setProjectSheetOpen(false)} onSave={async (name) => {
        const work = Platform.OS === "web" ? (await import("../work/webWorkStore")).webWorkStore : (await getNativeRepositories(userId)).work;
        const clients = await work.listClients(userId);
        const client = clients[0] ?? await work.createClient({ userId, name: "My client" });
        const project = await work.createProject({ userId, clientId: client.id, name, hourlyRateCents: 0 });
        setProjectId(project.id);
        setProjectSheetOpen(false);
        await refresh();
      }} /> : null}
      <SwipeDownSheet visible={!!detail} transparent={false} backdropStyle={styles.photoDetail} sheetStyle={styles.photoDetail} testID="photo-detail-sheet" onClose={() => setDetail(null)}>
        {detail ? <ScrollView contentContainerStyle={[styles.photoSheetContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <Pressable onPress={() => setDetail(null)}><Text style={styles.body}>Close</Text></Pressable>
          <Image accessibilityLabel="Photo evidence" resizeMode="contain" source={{ uri: detail.local_uri }} style={styles.photoDetailImage} />
          <Text style={styles.heading}>{photoTimeLabel(detail)}</Text>
          <Text style={styles.body}>{detail.captured_at ? new Date(detail.captured_at).toLocaleDateString() : "Capture date unknown"}</Text>
          <Text style={styles.body}>{photoAddress(detail)}</Text>
          <Text style={styles.body}>Type: {formatEvidenceType(detail.evidence_type)}</Text>
          <Text style={styles.body}>Note: {detail.caption || "No note"}</Text>
          <Text style={styles.body}>Project: {projects.find((project) => project.id === detail.project_id)?.name ?? "Project"}</Text>
          <Text style={styles.body}>{photoSealBadge(detail)}</Text>
          <Text style={styles.muted}>Source: {detail.capture_source ?? "Not recorded (older record)"} · Time source: {detail.capture_time_source ?? "unknown"}</Text>
          <Text style={styles.muted}>Seal: {detail.lock_hash ?? "Unavailable"}{detail.locked_at ? ` · ${new Date(detail.locked_at).toLocaleString()}` : ""}</Text>
          <Pressable disabled={!access.canCreateRecords} onPress={() => confirmDelete(detail)} style={[styles.actionButtonSecondary, !access.canCreateRecords && styles.disabledButton]}><Text style={[styles.actionButtonSecondaryText, (!access.canCreateRecords) && styles.disabledButtonText]}>Delete</Text></Pressable>
        </ScrollView> : null}
      </SwipeDownSheet>
    </View>
  );
}

function getExtension(uri: string): string {
  const extension = (uri.split("?")[0] ?? uri).split(".").pop();
  return extension && extension.length <= 5 ? extension : "jpg";
}

function formatEvidenceType(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getErrorMessage(error: unknown, action: string): string {
  if (error instanceof Error && /required|choose a project|permission/i.test(error.message)) return error.message;
  if (action === "save the photo") return "Couldn't save the photo. Check storage space.";
  return `Couldn't ${action}. Try again.`;
}

async function getNativeRepositories(userId: string) {
  return getLocalRepositories(userId);
}

function buildWebPhotoEvidenceRow(params: {
  userId: string;
  id: string;
  projectId: string;
  localUri: string;
  caption: string;
  evidenceType: PhotoEvidenceType;
  gps: PhotoGpsResult | null;
  capturedAt: string | null;
  captureSource: PhotoAction;
  captureTimeSource: string;
  lockHash: string | null;
  lockedAt: string | null;
}): PhotoEvidenceRow {
  return {
    id: params.id,
    user_id: params.userId,
    project_id: params.projectId,
    time_entry_id: null,
    local_uri: params.localUri,
    caption: params.caption.trim() || null,
    evidence_type: params.evidenceType,
    captured_at: params.capturedAt,
    capture_source: params.captureSource,
    capture_time_source: params.captureTimeSource,
    lock_hash: params.lockHash,
    locked_at: params.lockedAt,
    gps_latitude: (params.captureSource === "gallery" ? null : params.gps)?.coordinates?.latitude ?? null,
    gps_longitude: (params.captureSource === "gallery" ? null : params.gps)?.coordinates?.longitude ?? null,
    gps_message: params.captureSource === "gallery" ? "Gallery import: no GPS attached" : params.gps?.message ?? null,
    gps_accuracy_m: (params.captureSource === "gallery" ? null : params.gps)?.coordinates?.accuracy ?? null,
    status: "finalized",
  };
}

function readWebPhotoEvidenceRows(userId: string): PhotoEvidenceRow[] {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return [];
    }
    const parsed = JSON.parse(storage.getItem(getWebPhotoStorageKey(userId)) ?? "[]") as PhotoEvidenceRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWebPhotoEvidenceRows(rows: PhotoEvidenceRow[], userId: string): void {
  try {
    globalThis.localStorage?.setItem(getWebPhotoStorageKey(userId), JSON.stringify(rows));
  } catch {
    // Preview storage failure should not block the native evidence path.
  }
}

function getWebPhotoStorageKey(userId: string): string {
  return `${WEB_PHOTO_STORAGE_KEY}:${encodeURIComponent(userId)}`;
}

function photoAddress(row: PhotoEvidenceRow): string {
  return row.gps_latitude != null && row.gps_longitude != null ? row.gps_message?.startsWith("GPS address: ") ? row.gps_message.slice("GPS address: ".length) : "GPS point (no street name)" : "Location unknown";
}
function photoDay(row: PhotoEvidenceRow): string {
  return row.captured_at ? new Date(row.captured_at).toLocaleDateString() : "Capture date unknown";
}
function groupPhotos(rows: PhotoEvidenceRow[]) {
  const days = new Map<string, Map<string, PhotoEvidenceRow[]>>();
  for (const row of [...rows].sort((a, b) => (b.captured_at ?? "").localeCompare(a.captured_at ?? ""))) {
    const day = photoDay(row);
    if (!days.has(day)) days.set(day, new Map());
    const projects = days.get(day)!;
    if (!projects.has(row.project_id)) projects.set(row.project_id, []);
    projects.get(row.project_id)!.push(row);
  }
  return [...days].map(([title, projects]) => ({ title, data: [...projects.values()].flatMap((photos) => {
    const pairs: PhotoEvidenceRow[][] = [];
    for (let i = 0; i < photos.length; i += 2) pairs.push(photos.slice(i, i + 2));
    return pairs;
  }) }));
}
