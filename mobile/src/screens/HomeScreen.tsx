import { defaultDayType } from "../work/defaultDayType";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { ProjectNameSheet } from "./ProjectNameSheet";
import { styles, theme } from "../styles";
import { useSubscriptionAccess } from "../subscription/useSubscriptionAccess";
import type { WorkDayType, WorkHomeState, WorkProject } from "../work/workRepository";
import { formatLocationChip, locationReading, type LocationReading } from "../work/locationEvidence";
import { getWorkLocationWithTimeout } from "../work/workLocation";
import { buildAutomaticProjectName } from "../work/projectDraft";
import type { LocalAccount } from "../auth/localAuth";
import { formatTrialCountdown } from "../subscription/subscriptionClient";

export function HomeScreen({ account, onCreateAccount }: { account: LocalAccount; onCreateAccount: () => void }) {
  const locationRequest = useRef(0);
  const savingStart = useRef(false);
  const access = useSubscriptionAccess(account);
  const userId = account.id ?? account.email.trim().toLowerCase();
  const [clockInAt, setClockInAt] = useState<Date | null>(null);
  const [clockOutAt, setClockOutAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [homeState, setHomeState] = useState<WorkHomeState | null>(null);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [workStatus, setWorkStatus] = useState("");
  const [locationFix, setLocationFix] = useState<LocationReading | null>(null);
  const [locating, setLocating] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [workerNote, setWorkerNote] = useState("");
  const [locationEntryId, setLocationEntryId] = useState<string | null>(null);
  const [locationPhase, setLocationPhase] = useState<"start" | "stop">("start");
  const [stopping, setStopping] = useState(false);
  const [activityText, setActivityText] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [dayType, setDayType] = useState<WorkDayType>(() => defaultDayType(new Date()));
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void refreshWorkState();
  }, []);

  const elapsedMinutes = useMemo(() => {
    if (!clockInAt) {
      return 0;
    }

    const end = clockOutAt ?? now;
    return Math.max(0, Math.floor((end.getTime() - clockInAt.getTime()) / 60000));
  }, [clockInAt, clockOutAt, now]);

  const clockStatus = clockInAt && !clockOutAt ? "Working" : "Not started";
  const trackedTodayMinutes = homeState?.totalMinutesToday ?? 0;
  const activeProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId) ?? null
    : null;
  async function refreshWorkState() {
    try {
      const store = await getWorkStore(userId);
      const [nextState, nextProjects] = await Promise.all([
        store.getHomeState(userId),
        store.listProjects(userId),
      ]);
      setHomeState(nextState);
      setProjects(nextProjects);
      if (nextState.activeEntry?.startTime) {
        setSelectedProjectId(nextState.activeEntry.projectId);
        setDayType(nextState.activeEntry.dayType);
        setClockInAt(new Date(nextState.activeEntry.startTime));
        setClockOutAt(null);
        setLocationEntryId(nextState.activeEntry.id);
        setLocationPhase("start");
        const entry = nextState.activeEntry;
        const history = JSON.parse(entry.locationHistoryJson || "[]") as LocationReading[];
        setLocationFix(history.filter((fix) => fix.phase === "start").at(-1) ?? {
          phase: "start", source: entry.clockInLocationSource ?? "legacy", address: entry.locationText,
          latitude: entry.clockInGpsLatitude, longitude: entry.clockInGpsLongitude,
          accuracy: entry.clockInGpsAccuracyM ?? null, locatedAt: entry.clockInLocatedAt ?? null,
        });
        setWorkerNote(entry.locationNote ?? "");
      } else {
        const recent = nextState.recentEntries[0];
        if (recent?.endTime && Date.now() - new Date(recent.endTime).getTime() <= 600_000) {
          setLocationEntryId(recent.id);
          setLocationPhase("stop");
          setClockInAt(recent.startTime ? new Date(recent.startTime) : null);
          setClockOutAt(new Date(recent.endTime));
          const history = JSON.parse(recent.locationHistoryJson || "[]") as LocationReading[];
          setLocationFix(history.filter((fix) => fix.phase === "stop").at(-1) ?? { phase: "stop", source: recent.clockOutLocationSource ?? "legacy", address: recent.clockOutLocationText ?? null, latitude: recent.clockOutGpsLatitude, longitude: recent.clockOutGpsLongitude, accuracy: recent.clockOutGpsAccuracyM ?? null, locatedAt: recent.clockOutLocatedAt ?? null });
          setWorkerNote(recent.locationNote ?? "");
        } else {
          setClockInAt(null);
          setClockOutAt(null);
          setLocationEntryId(null);
          setLocationFix(null);
        }
        setSelectedProjectId((current) =>
          nextProjects.some((project) => project.id === current)
            ? current
            : nextState.project?.id ?? nextProjects[0]?.id ?? null,
        );
      }
    } catch (error) {
      setWorkStatus(getErrorMessage(error));
    }
  }

  async function handleClockIn() {
    if (savingStart.current) return;
    if (!access.hasCurrentCreateAccess()) {
      setWorkStatus("An active trial or subscription is required to create new time records.");
      return;
    }
    savingStart.current = true;
    const request = ++locationRequest.current;
    const nextClockIn = new Date();
    try {
      const store = await getWorkStore(userId);
      let projectId = selectedProjectId;
      if (!projectId) {
        if (!("createClient" in store) || !("createProject" in store)) throw new Error("Project creation is unavailable.");
        const client = await store.createClient({ userId, name: "Local Client" });
        const project = await store.createProject({ userId, clientId: client.id, name: buildAutomaticProjectName(nextClockIn), hourlyRateCents: 0, currency: "SGD" });
        projectId = project.id;
        setSelectedProjectId(project.id);
      }
      const entry = await store.clockIn({ userId, projectId, clockInAt: nextClockIn, dayType });
      savingStart.current = false;
      setLocationEntryId(entry.id);
      setLocationPhase("start");
      setLocationFix(null);
      setLocating(true);
      setClockInAt(nextClockIn);
      setClockOutAt(null);
      setNow(nextClockIn);
      setWorkStatus(`Started at ${formatTime(nextClockIn)}.`);
      await refreshWorkState();
      try {
        const location = await getWorkLocationWithTimeout(20_000);
        const params = { userId, entryId: entry.id, phase: "start" as const, locationText: location?.address ?? undefined, gpsLatitude: location?.latitude ?? null, gpsLongitude: location?.longitude ?? null, gpsAccuracyM: location?.accuracy ?? null, locatedAt: location?.timestamp ?? null };
        if (request !== locationRequest.current) return;
        if (await store.completeStartLocation(params)) setLocationFix(locationReading(params, "start"));
      } finally { if (request === locationRequest.current) setLocating(false); }
    } catch (error) {
      setWorkStatus(getErrorMessage(error));
    } finally { savingStart.current = false; }
  }

  async function handleLocateMe() {
    if (!locationEntryId || locating || stopping) return;
    const request = ++locationRequest.current;
    setLocating(true);
    try {
      const location = await getWorkLocationWithTimeout(20_000);
      if (request !== locationRequest.current) return;
      const store = await getWorkStore(userId);
      const params = { userId, entryId: locationEntryId, phase: locationPhase, locationText: location?.address ?? undefined, gpsLatitude: location?.latitude ?? null, gpsLongitude: location?.longitude ?? null, gpsAccuracyM: location?.accuracy ?? null, locatedAt: location?.timestamp ?? null };
      await store.refreshLocation(params);
      setLocationFix(locationReading(params, locationPhase));
    } catch (error) { setWorkStatus(getErrorMessage(error)); }
    finally { if (request === locationRequest.current) setLocating(false); }
  }

  async function handleSaveLocationNote() {
    if (!locationEntryId) return;
    try {
      const store = await getWorkStore(userId);
      await store.saveLocationNote({ userId, entryId: locationEntryId, note: workerNote });
      setNoteExpanded(false);
    } catch (error) { setWorkStatus(getErrorMessage(error)); }
  }

  async function handleClockOut() {
    if (stopping || !clockInAt || clockOutAt || !homeState?.activeEntry) {
      return;
    }

    ++locationRequest.current;
    setStopping(true);
    const nextClockOut = new Date();
    try {
      const store = await getWorkStore(userId);
      setWorkStatus("Stopping work and getting location...");
      setLocating(true);
      const location = await getWorkLocationWithTimeout(10_000, { prompt: false });
      await store.clockOut({
        userId,
        entryId: homeState.activeEntry.id,
        clockOutAt: nextClockOut,
        breakMinutes: parseBreakMinutes(breakMinutes),
        activity: activityText,
        clockOutLocationText: location?.address ?? undefined,
        gpsAccuracyM: location?.accuracy ?? null,
        locatedAt: location?.timestamp ?? null,
        gpsLatitude: location?.latitude ?? null,
        gpsLongitude: location?.longitude ?? null,
      });
      setLocationPhase("stop");
      setLocationFix(locationReading({ locationText: location?.address ?? undefined, gpsLatitude: location?.latitude, gpsLongitude: location?.longitude, gpsAccuracyM: location?.accuracy, locatedAt: location?.timestamp }, "stop"));
      setClockOutAt(nextClockOut);
      setDayType(defaultDayType(nextClockOut));
      setNow(nextClockOut);
      setWorkStatus(`Stopped at ${formatTime(nextClockOut)}.`);
      await refreshWorkState();
    } catch (error) {
      setWorkStatus(getErrorMessage(error));
    } finally { setLocating(false); setStopping(false); }
  }

  async function handleDeleteEntry(entryId: string) {
    if (pendingDeleteEntryId !== entryId) {
      setPendingDeleteEntryId(entryId);
      setWorkStatus("Tap Confirm Delete to remove this recent time entry.");
      return;
    }

    try {
      const store = await getWorkStore(userId);
      if (!("deleteEntry" in store) || typeof store.deleteEntry !== "function") {
        throw new Error("This can't be done right now. Please try again.");
      }
      await store.deleteEntry({ userId, entryId });
      setPendingDeleteEntryId(null);
      setWorkStatus("Time entry deleted.");
      await refreshWorkState();
    } catch (error) {
      setWorkStatus(getErrorMessage(error));
    }
  }

  return (
    <>
      <View style={styles.clockPanel}>
        <View style={styles.clockHeader}>
          <View>
            <Text style={styles.eyebrow}>Today</Text>
            <Text style={styles.heading}>Work today</Text>
          </View>
          <View style={styles.clockBadge}>
            <Text style={styles.clockBadgeText}>{clockStatus}</Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.metricTile}>
            <Text style={styles.metricValue}>
              {formatElapsed(trackedTodayMinutes || elapsedMinutes)}
            </Text>
            <Text style={styles.metricLabel}>today</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricValue}>
              {clockInAt ? formatTime(clockInAt) : "--:--"}
            </Text>
            <Text style={styles.metricLabel}>started</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!clockInAt && !access.canCreateRecords}
          onPress={() => void (clockInAt && !clockOutAt ? handleClockOut() : handleClockIn())}
          style={[styles.actionButton, { minHeight: 64 }, !clockInAt && !access.canCreateRecords && styles.disabledButton]}
        >
          <Text style={[styles.actionButtonText, (!clockInAt && !access.canCreateRecords) && styles.disabledButtonText]}>{clockInAt && !clockOutAt ? "Stop work" : "Start work"}</Text>
        </Pressable>
        <Text style={styles.inputLabel}>Day type</Text>
        <View style={styles.dayTypeRow}>
          {DAY_TYPE_OPTIONS.map((option) => {
            const selected = option.id === dayType;
            const disabled = Boolean(clockInAt && !clockOutAt);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                key={option.id}
                onPress={() => setDayType(option.id)}
                style={[
                  selected ? styles.actionButton : styles.actionButtonSecondary,
                  styles.dayTypeSegment,
                  disabled && styles.disabledButton,
                ]}
              >
                <Text style={[selected ? styles.actionButtonText : styles.actionButtonSecondaryText, (disabled) && styles.disabledButtonText]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {clockInAt && !clockOutAt ? <Text style={styles.muted}>Day type can be changed after stopping.</Text> : null}
        {workStatus ? <Text style={styles.muted}>{workStatus}</Text> : null}
        <Text style={styles.muted}>Project: {activeProject?.name ?? "Auto-create Job 1"} · {formatDayType(dayType)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh GPS location" disabled={locating || stopping || !locationEntryId || (locationPhase === "stop" && (!clockOutAt || now.getTime() - clockOutAt.getTime() > 600_000))} onPress={() => void handleLocateMe()} style={[styles.locationChip, (locating || stopping || !locationEntryId || (locationPhase === "stop" && (!clockOutAt || now.getTime() - clockOutAt.getTime() > 600_000))) && styles.disabledButton]}>
          <Text style={[styles.locationChipText, (locating || stopping || !locationEntryId || (locationPhase === "stop" && (!clockOutAt || now.getTime() - clockOutAt.getTime() > 600_000))) && styles.disabledButtonText]}>{formatLocationChip(locationFix, locating)}</Text>
        </Pressable>
        {!locationFix || locationFix.source !== "gps" ? <Pressable accessibilityRole="button" onPress={() => setNoteExpanded((value) => !value)}><Text style={styles.muted}>Add a note</Text></Pressable> : null}
        {workerNote ? <Text style={styles.muted}>Note (typed by you): {workerNote}</Text> : null}
        {noteExpanded ? <View>
          <Text style={styles.inputLabel}>Note (typed by you)</Text>
          <TextInput placeholderTextColor={theme.colors.placeholder} accessibilityLabel="Worker note" value={workerNote} onChangeText={setWorkerNote} style={styles.textInput} placeholder="Optional worker note" />
          <Pressable accessibilityRole="button" onPress={() => void handleSaveLocationNote()} style={styles.actionButtonSecondary}><Text style={styles.actionButtonSecondaryText}>Save note</Text></Pressable>
        </View> : null}
        {account.isGuest && access.trialDaysLeft != null ? <Text style={styles.muted}>Free trial · {access.trialDaysLeft} day{access.trialDaysLeft === 1 ? "" : "s"} left</Text> : null}
        {!account.isGuest && formatTrialCountdown(access.subscription) ? <Text style={styles.muted}>{formatTrialCountdown(access.subscription)}</Text> : null}
        {access.subscription && !access.canCreateRecords ? (
          <View style={[styles.card, styles.warningCard]}>
            <Text style={styles.heading}>{account.isGuest ? "Your 30-day free trial has ended." : "Your trial or subscription is not active."}</Text>
            <Text style={styles.body}>{account.isGuest
              ? "Create a free account to keep your records, then subscribe to continue logging and exporting. All your records stay viewable."
              : "Subscribe in Settings > Plan & billing to continue logging and exporting. All your records stay viewable."}</Text>
            {clockInAt && !clockOutAt ? <Text style={styles.body}>You can still tap Stop work to finish the current shift.</Text> : null}
            {account.isGuest ? <Pressable accessibilityRole="button" onPress={onCreateAccount} style={styles.actionButton}><Text style={styles.actionButtonText}>Create account</Text></Pressable> : null}
          </View>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsExpanded }} onPress={() => setDetailsExpanded((value) => !value)} style={styles.actionButtonSecondary}>
          <Text style={styles.actionButtonSecondaryText}>Project &amp; day details {detailsExpanded ? "▲" : "▼"}</Text>
        </Pressable>

        {detailsExpanded ? <>

        <Pressable style={[(Boolean(clockInAt && !clockOutAt)) && styles.disabledButton]} disabled={Boolean(clockInAt && !clockOutAt)} onPress={() => setProjectPickerOpen(!projectPickerOpen)}><Text style={[styles.body, (Boolean(clockInAt && !clockOutAt)) && styles.disabledButtonText]}>Project: {activeProject?.name ?? "Auto-create Job 1"} ›</Text></Pressable>
        {projectPickerOpen ? <View style={styles.card}>{projects.filter((project) => project.status !== "archived").map((project) => <Pressable key={project.id} onPress={() => { setSelectedProjectId(project.id); setProjectPickerOpen(false); }}><Text style={styles.body}>{project.name}</Text></Pressable>)}<Pressable style={[(!access.canCreateRecords) && styles.disabledButton]} disabled={!access.canCreateRecords} onPress={() => setProjectSheetOpen(true)}><Text style={[styles.body, (!access.canCreateRecords) && styles.disabledButtonText]}>+ New project</Text></Pressable></View> : null}
        {projectSheetOpen ? <ProjectNameSheet onClose={() => setProjectSheetOpen(false)} onSave={async (name) => {
          if (!access.canCreateRecords) throw new Error(access.message);
          const store = await getWorkStore(userId);
          const clients = await store.listClients(userId);
          const client = clients[0] ?? await store.createClient({ userId, name: "My client" });
          const project = await store.createProject({ userId, clientId: client.id, name, hourlyRateCents: 0 });
          await refreshWorkState(); setSelectedProjectId(project.id); setProjectPickerOpen(false);
        }} /> : null}
        </> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Recent time</Text>
        {homeState?.recentEntries.length ? (
          <View style={styles.list}>
            {homeState.recentEntries.slice(0, 4).map((entry) => {
              const isConfirmingDelete = pendingDeleteEntryId === entry.id;
              return (
              <View key={entry.id} style={styles.row}>
                <View style={styles.recentTimeContent}>
                  <View>
                    <Text style={styles.rowLabel}>{entry.projectName}</Text>
                    <Text style={styles.muted}>
                      {entry.workDate} - {formatDayType(entry.dayType)} - {entry.endTime ? "Clocked out" : "Active"}
                    </Text>
                    <Text style={styles.body}>{entry.activity}</Text>
                  </View>
                  <View style={styles.recentTimeActions}>
                    <Text style={styles.rowValue}>
                      {formatElapsed(entry.durationMinutes)}
                    </Text>
                    {isConfirmingDelete ? (
                      <View style={styles.deleteConfirmRow}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setPendingDeleteEntryId(null)}
                          style={styles.compactSecondaryButton}
                        >
                          <Text style={styles.compactSecondaryButtonText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void handleDeleteEntry(entry.id)}
                          style={styles.compactDangerButton}
                        >
                          <Text style={styles.compactDangerButtonText}>Confirm Delete</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityLabel={`Delete time entry for ${entry.projectName}`}
                        accessibilityRole="button"
                        onPress={() => void handleDeleteEntry(entry.id)}
                        style={styles.compactSecondaryButton}
                      >
                        <Text style={styles.compactSecondaryButtonText}>Delete</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.muted}>
            No saved time entries yet. Tap Start work to begin.
          </Text>
        )}
      </View>

    </>
  );
}

const DAY_TYPE_OPTIONS: Array<{ id: WorkDayType; label: string }> = [
  { id: "normal", label: "Normal" },
  { id: "off_day", label: "Off day" },
  { id: "holiday", label: "Holiday" },
];

async function getWorkStore(userId: string) {
  if (Platform.OS === "web") {
    const { webWorkStore } = await import("../work/webWorkStore");
    return webWorkStore;
  }

  const { getLocalRepositories } = await import("../db/repositories");
  const repositories = await getLocalRepositories(userId);
  return repositories.work;
}

function formatElapsed(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayType(value: WorkDayType): string {
  if (value === "off_day") {
    return "Off day";
  }
  if (value === "holiday") {
    return "Holiday";
  }
  return "Normal";
}

function parseBreakMinutes(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function getErrorMessage(error: unknown): string {
  return "Something went wrong. Please try again.";
}
