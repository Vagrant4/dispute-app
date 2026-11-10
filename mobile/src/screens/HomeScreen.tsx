import { defaultDayType } from "../work/defaultDayType";
import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  Text,
  Linking,
  View,
} from "react-native";

import { ProjectNameSheet } from "./ProjectNameSheet";
import { ProjectPickerSheet } from "./ProjectPickerSheet";
import { NoteSheet } from "./NoteSheet";
import { TaskPickerSheet } from "./TaskPickerSheet";
import { LocationMap } from "./LocationMap";
import { styles } from "../styles";
import { useSubscriptionAccess } from "../subscription/useSubscriptionAccess";
import type { WorkDayType, WorkHomeState, WorkProject, WorkTask } from "../work/workRepository";
import { locationReading, type LocationReading } from "../work/locationEvidence";
import { getWorkLocationWithTimeout, locationRetryAction, type WorkLocationReason } from "../work/workLocation";
import { summarizeBreaks } from "../work/shiftTimeline";
import { formatWorkedClock, workedSecondsToday, formatClockTime } from "../work/todayDisplay";
import { startReadiness } from "../work/startReadiness";
import type { LocalAccount } from "../auth/localAuth";
import { formatTrialDaysLeft } from "../uiReviewFormatters";

const TODAY_SECTIONS = ["timerCard", "quickActions", "map", "clock"] as const;

export function TodayRunningControls({ onBreak, onBreakPress, tasks, onSwitchTask }: { onBreak: boolean; onBreakPress: () => void; tasks: WorkTask[]; onSwitchTask: (taskId: string) => void }) {
  const [choosingTask, setChoosingTask] = useState(false);
  return <View style={styles.todayProjectActions}>
    <Pressable onPress={onBreakPress} style={styles.actionButtonSecondary}><Text style={styles.actionButtonSecondaryText}>{onBreak ? "End break" : "Break"}</Text></Pressable>
    {tasks.length ? <Pressable onPress={() => setChoosingTask(true)} style={styles.actionButtonSecondary}><Text style={styles.actionButtonSecondaryText}>Switch task</Text></Pressable> : null}
    {choosingTask ? <TaskPickerSheet tasks={tasks} onClose={() => setChoosingTask(false)} onSelect={(id) => { setChoosingTask(false); onSwitchTask(id); }} onAdd={async () => undefined} /> : null}
  </View>;
}

export function HomeScreen({ account, onOpenPhotos }: { account: LocalAccount; onOpenPhotos?: (projectId?: string) => void }) {
  const locationRequest = useRef(0);
  const pendingLocations = useRef<LocationReading[]>([]);
  const [locationReason, setLocationReason] = useState<WorkLocationReason | null>(null);
  const savingStart = useRef(false);
  const access = useSubscriptionAccess(account);
  const userId = account.id ?? account.email.trim().toLowerCase();
  const [clockInAt, setClockInAt] = useState<Date | null>(null);
  const [clockOutAt, setClockOutAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [homeState, setHomeState] = useState<WorkHomeState | null>(null);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [workStatus, setWorkStatus] = useState("");
  const [locationFix, setLocationFix] = useState<LocationReading | null>(null);
  const [showLocationDetails, setShowLocationDetails] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationEntryId, setLocationEntryId] = useState<string | null>(null);
  const [locationPhase, setLocationPhase] = useState<"start" | "stop">("start");
  const [stopping, setStopping] = useState(false);
  const [activityText, setActivityText] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [dayType, setDayType] = useState<WorkDayType>(() => defaultDayType(new Date()));
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), clockInAt && !clockOutAt ? 1000 : 15_000);
    return () => clearInterval(timer);
  }, [clockInAt, clockOutAt]);

  useEffect(() => {
    let active = true;
    void refreshWorkState().then(() => {
      if (active) void handleLocateMe(false);
    });
    return () => { active = false; };
  }, []);

  const activeProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId) ?? null
    : null;
  const isRunning = Boolean(clockInAt && !clockOutAt);
  const readiness = startReadiness({ hasLocation: locationFix?.source === "gps", hasProject: Boolean(activeProject) });
  const startDisabled = isRunning ? stopping : !access.canCreateRecords;
  const breakSummary = summarizeBreaks(homeState?.activeEntry?.breakIntervals ?? [], now);
  const onBreak = Boolean(homeState?.activeEntry?.breakIntervals.some((item) => !item.endedAt));
  const workedSeconds = Math.max(0, workedSecondsToday(homeState?.totalMinutesToday ?? 0, isRunning ? clockInAt : null, now) - breakSummary.seconds);
  const trialDaysLeft = access.subscription?.status === "TRIALING" && access.subscription.trialEndsAt
    ? formatTrialDaysLeft(access.subscription.trialEndsAt, now.getTime()) : null;
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (projectSheetOpen) { setProjectSheetOpen(false); return true; }
      if (projectPickerOpen) { setProjectPickerOpen(false); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [projectPickerOpen, projectSheetOpen]);
  async function refreshWorkState() {
    try {
      const store = await getWorkStore(userId);
      const [nextState, nextProjects] = await Promise.all([
        store.getHomeState(userId),
        store.listProjects(userId),
      ]);
      setHomeState(nextState);
      setProjects(nextProjects);
      const activeProjects = nextProjects.filter((project) => project.status !== "archived");
      if (nextState.activeEntry?.startTime) {
        setSelectedProjectId(nextState.activeEntry.projectId);
        setDayType(nextState.activeEntry.dayType);
        setClockInAt(new Date(nextState.activeEntry.startTime));
        setClockOutAt(null);
        setLocationEntryId(nextState.activeEntry.id);
        setLocationPhase("start");
        setSelectedTaskId(nextState.activeEntry.currentTaskId);
        setTasks(await store.listTasks(userId, nextState.activeEntry.projectId));
        const entry = nextState.activeEntry;
        const history = JSON.parse(entry.locationHistoryJson || "[]") as LocationReading[];
        setLocationFix(history.filter((fix) => fix.phase === "start").at(-1) ?? {
          phase: "start", source: entry.clockInLocationSource ?? "legacy", address: entry.locationText,
          latitude: entry.clockInGpsLatitude, longitude: entry.clockInGpsLongitude,
          accuracy: entry.clockInGpsAccuracyM ?? null, locatedAt: entry.clockInLocatedAt ?? null,
        });
      } else {
        const recent = nextState.recentEntries[0];
        if (recent?.endTime && Date.now() - new Date(recent.endTime).getTime() <= 600_000) {
          setLocationEntryId(recent.id);
          setLocationPhase("stop");
          setClockInAt(recent.startTime ? new Date(recent.startTime) : null);
          setClockOutAt(new Date(recent.endTime));
          const history = JSON.parse(recent.locationHistoryJson || "[]") as LocationReading[];
          setLocationFix(history.filter((fix) => fix.phase === "stop").at(-1) ?? { phase: "stop", source: recent.clockOutLocationSource ?? "legacy", address: recent.clockOutLocationText ?? null, latitude: recent.clockOutGpsLatitude, longitude: recent.clockOutGpsLongitude, accuracy: recent.clockOutGpsAccuracyM ?? null, locatedAt: recent.clockOutLocatedAt ?? null });
        } else {
          setClockInAt(null);
          setClockOutAt(null);
          setLocationEntryId(null);
          setLocationFix(pendingLocations.current.at(-1) ?? null);
        }
        setSelectedProjectId((current) =>
          activeProjects.some((project) => project.id === current)
            ? current
            : activeProjects.length === 1 ? activeProjects[0].id : null,
        );
        const nextProjectId = activeProjects.some((project) => project.id === selectedProjectId) ? selectedProjectId : activeProjects.length === 1 ? activeProjects[0].id : null;
        setTasks(nextProjectId ? await store.listTasks(userId, nextProjectId) : []);
      }
    } catch (error) {
      setWorkStatus(getErrorMessage(error, "load today's work"));
    }
  }

  async function handleClockIn() {
    if (savingStart.current) return;
    if (readiness.missing === "location" || readiness.missing === "both") {
      if ((locationRetryAction?.(locationReason) ?? (locationReason === "denied" || locationReason === "services_off" ? "settings" : "retry")) === "settings") void Linking.openSettings(); else await handleLocateMe();
      return;
    }
    if (readiness.missing === "project") { setProjectPickerOpen(true); return; }
    if (!access.hasCurrentCreateAccess()) {
      setWorkStatus("An active trial or subscription is required to create new time records.");
      return;
    }
    savingStart.current = true;
    const request = ++locationRequest.current;
    const nextClockIn = new Date();
    try {
      const store = await getWorkStore(userId);
      const projectId = selectedProjectId!;
      const entry = await store.clockIn({ userId, projectId, clockInAt: nextClockIn, dayType, taskId: selectedTaskId });
      for (const fix of pendingLocations.current) {
        await store.refreshLocation({ userId, entryId: entry.id, phase: "start", locationText: fix.address ?? undefined, gpsLatitude: fix.latitude, gpsLongitude: fix.longitude, gpsAccuracyM: fix.accuracy, locatedAt: fix.locatedAt });
      }
      pendingLocations.current = [];
      savingStart.current = false;
      setLocationEntryId(entry.id);
      setLocationPhase("start");
      setLocating(true);
      setClockInAt(nextClockIn);
      setClockOutAt(null);
      setNow(nextClockIn);
      setWorkStatus("");
      await refreshWorkState();
      try {
        const location = await getWorkLocationWithTimeout(20_000);
        const params = { userId, entryId: entry.id, phase: "start" as const, locationText: location?.address ?? undefined, addressParts: location?.addressParts, gpsLatitude: location?.latitude ?? null, gpsLongitude: location?.longitude ?? null, gpsAccuracyM: location?.accuracy ?? null, locatedAt: location?.timestamp ?? null };
        if (request !== locationRequest.current) return;
        if (await store.completeStartLocation(params)) setLocationFix(locationReading(params, "start"));
      } finally { if (request === locationRequest.current) setLocating(false); }
    } catch (error) {
      setWorkStatus(getErrorMessage(error, "start the shift"));
    } finally { savingStart.current = false; }
  }

  async function handleLocateMe(revealDetails = true) {
    if (locating || stopping) return;
    const request = ++locationRequest.current;
    setLocating(true);
    try {
      const location = await getWorkLocationWithTimeout(20_000, { geocode: revealDetails });
      if (request !== locationRequest.current) return;
      const canRefreshEntry = locationEntryId && (locationPhase === "start" || (clockOutAt && now.getTime() - clockOutAt.getTime() <= 600_000));
      const params = { userId, entryId: locationEntryId!, phase: locationPhase, locationText: location?.address ?? undefined, addressParts: location?.addressParts, gpsLatitude: location?.latitude ?? null, gpsLongitude: location?.longitude ?? null, gpsAccuracyM: location?.accuracy ?? null, locatedAt: location?.timestamp ?? null };
      const fix = locationReading(params, canRefreshEntry ? locationPhase : "start");
      setLocationReason(location.reason);
      if (canRefreshEntry) {
        const store = await getWorkStore(userId);
        await store.refreshLocation(params);
      }
      else if (fix.source === "gps") pendingLocations.current.push(fix);
      if (revealDetails || fix.source === "gps") setLocationFix(fix);
      if (fix.source === "gps" && revealDetails) setShowLocationDetails(true);
    } catch (error) { setWorkStatus(getErrorMessage(error, "refresh the location")); }
    finally { if (request === locationRequest.current) setLocating(false); }
  }

  function handleLocatePress() {
    if (locationFix?.source === "gps") setShowLocationDetails(true);
    if ((locationRetryAction?.(locationReason) ?? (locationReason === "denied" || locationReason === "services_off" ? "settings" : "retry")) === "settings") void Linking.openSettings(); else void handleLocateMe();
  }

  function useTestLocation() {
    const fix: LocationReading = {
      phase: "start",
      source: "gps",
      address: "Test location · Singapore",
      latitude: 1.3521,
      longitude: 103.8198,
      accuracy: 15,
      locatedAt: new Date().toISOString(),
    };
    pendingLocations.current.push(fix);
    setLocationFix(fix);
    setLocationReason(null);
    setWorkStatus("Test location selected. This is not a live GPS reading.");
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
        breakMinutes: breakSummary.minutes,
        activity: activityText,
        clockOutLocationText: location?.address ?? undefined,
        gpsAccuracyM: location?.accuracy ?? null,
        locatedAt: location?.timestamp ?? null,
        gpsLatitude: location?.latitude ?? null,
        gpsLongitude: location?.longitude ?? null,
      });
      setLocationPhase("stop");
      setLocationFix(locationReading({ locationText: location?.address ?? undefined, addressParts: location?.addressParts, gpsLatitude: location?.latitude, gpsLongitude: location?.longitude, gpsAccuracyM: location?.accuracy, locatedAt: location?.timestamp }, "stop"));
      setClockOutAt(nextClockOut);
      setDayType(defaultDayType(nextClockOut));
      setNow(nextClockOut);
      setWorkStatus("");
      await refreshWorkState();
    } catch (error) {
      setWorkStatus(getErrorMessage(error, "stop the shift"));
    } finally { setLocating(false); setStopping(false); }
  }

  async function handleBreak() {
    if (!homeState?.activeEntry) return;
    const store = await getWorkStore(userId);
    if (onBreak) await store.endBreak({ userId, entryId: homeState.activeEntry.id }); else await store.startBreak({ userId, entryId: homeState.activeEntry.id });
    await refreshWorkState();
  }

  async function handleSwitchTask(taskId: string) {
    const store = await getWorkStore(userId);
    if (homeState?.activeEntry) await store.switchTask({ userId, entryId: homeState.activeEntry.id, taskId });
    setSelectedTaskId(taskId); setTaskPickerOpen(false); await refreshWorkState();
  }

  async function handleAddTask(name: string) {
    if (!activeProject) throw new Error("Choose a project first.");
    const store = await getWorkStore(userId); const task = await store.addTask({ userId, projectId: activeProject.id, name });
    setTasks(await store.listTasks(userId, activeProject.id)); setSelectedTaskId(task.id);
  }

  const renderTimerCard = (key: string) => (
    <View key={key} style={styles.todayTimerCard} testID="today-timer-card">
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.todayClock} testID="today-timer">
        {isRunning ? formatWorkedClock(workedSeconds) : "00:00:00"}
      </Text>
      <Text style={styles.todayStarted} testID="today-started">
        {isRunning && clockInAt ? `Started ${formatClockTime(clockInAt)}` : "Not clocked in"}
      </Text>
      {onBreak ? <Text style={styles.todayStarted}>On break · {formatWorkedClock(breakSummary.seconds)}</Text> : null}
      {trialDaysLeft != null && trialDaysLeft > 0 && trialDaysLeft <= 3 ? <Text style={styles.todayTrial}>{trialDaysLeft} days left in your free trial</Text> : null}
      <View style={styles.todayProjectActions} testID="today-project-actions">
        <Pressable accessibilityRole="button" accessibilityLabel={activeProject?.name ?? "Choose a project"} accessibilityState={{ disabled: isRunning }} disabled={isRunning} onPress={() => setProjectPickerOpen(!projectPickerOpen)} style={styles.todayEvidenceRow}>
          <View style={styles.todayRowContent}>
            <Text style={styles.todayProjectLabel}>Project</Text>
            <Text style={styles.todayRowTitle}>{activeProject?.name ?? "Choose a project"}</Text>
          </View>
        </Pressable>
        {tasks.length ? <Pressable accessibilityRole="button" accessibilityLabel="Choose task" onPress={() => setTaskPickerOpen(true)} style={styles.todayEvidenceRow}><View style={styles.todayRowContent}><Text style={styles.todayProjectLabel}>Task</Text><Text style={styles.todayRowTitle}>{tasks.find((task) => task.id === selectedTaskId)?.name ?? "Choose task"}</Text></View></Pressable> : null}
        {!isRunning ? <Pressable accessibilityLabel="Add project" accessibilityRole="button" disabled={!access.canCreateRecords} onPress={() => setProjectSheetOpen(true)} style={[styles.todayAddProjectButton, !access.canCreateRecords && styles.disabledButton]} testID="today-add-project"><Text style={[styles.todayAddProjectText, !access.canCreateRecords && styles.disabledButtonText]}>+ Add project</Text></Pressable> : null}
      </View>
    </View>
  );

  const renderQuickActions = (key: string) => (
    <View key={key} style={styles.todayQuickActions}>
      <Pressable accessibilityLabel="Open project photos" accessibilityRole="button" onPress={() => onOpenPhotos?.(selectedProjectId ?? undefined)} style={styles.todayPhotoAction} testID="today-photo-action">
        <Image source={require("../../assets/icons/tab-photos.png")} style={styles.todayPhotoIcon} />
        <Text style={styles.todayPhotoLabel}>Photo</Text>
      </Pressable>
      {isRunning ? <Pressable accessibilityLabel="Open shift notes" accessibilityRole="button" onPress={() => setNoteOpen(true)} style={styles.todayPhotoAction} testID="today-note-action"><Text style={styles.todayPhotoLabel}>Notes</Text></Pressable> : null}
    </View>
  );

  const renderClock = (key: string) => (
    <View key={key} style={styles.todayClockAction}>
      {isRunning ? <TodayRunningControls onBreak={onBreak} onBreakPress={() => void handleBreak()} tasks={tasks} onSwitchTask={(id) => void handleSwitchTask(id)} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={isRunning ? "Clock out" : "Clock in"} accessibilityState={{ disabled: startDisabled }} disabled={startDisabled} onPress={() => void (isRunning ? handleClockOut() : handleClockIn())} style={[styles.todayClockButton, isRunning && styles.todayStopButton, startDisabled && styles.disabledButton]}>
        <Text style={[styles.todayRoundText, isRunning && styles.todayStopText, startDisabled && styles.disabledButtonText]}>{isRunning ? "Clock out" : "Clock in"}</Text>
      </Pressable>
    </View>
  );

  const renderMap = (key: string) => (
    <View key={key} style={styles.locationMapFrame} testID="today-map">
      <LocationMap reading={locationFix} locating={locating} showDetails={showLocationDetails} />
      <Pressable accessibilityLabel="Show my location" accessibilityRole="button" disabled={locating || stopping} onPress={handleLocatePress} style={[styles.locationMapLocateButton, (locating || stopping) && styles.disabledButton]} testID="today-locate-button">
        <View accessible={false} style={styles.locationReticle} testID="today-locate-reticle">
          <View style={[styles.locationReticleCircle, (locating || stopping) && styles.locationReticleCircleDisabled]} />
          <View style={[styles.locationReticleHorizontal, (locating || stopping) && styles.locationReticleLineDisabled]} />
          <View style={[styles.locationReticleVertical, (locating || stopping) && styles.locationReticleLineDisabled]} />
          <View style={[styles.locationReticleDot, (locating || stopping) && styles.locationReticleLineDisabled]} />
        </View>
      </Pressable>
    </View>
  );

  const todaySectionRenderers = { timerCard: renderTimerCard, quickActions: renderQuickActions, map: renderMap, clock: renderClock };

  return (
    <View style={styles.todayScreen}>
      <View style={styles.todayHeader}>
        <Text style={styles.todayTitle}>Today</Text>
        <Text style={styles.todayWordmark}>DISPUTE</Text>
      </View>
      <View style={styles.todaySections}>
        {TODAY_SECTIONS.map((section) => todaySectionRenderers[section](section))}
      </View>
      <View>
        {projectPickerOpen ? <ProjectPickerSheet
          footer={<Pressable style={[(!access.canCreateRecords) && styles.disabledButton]} disabled={!access.canCreateRecords} onPress={() => { setProjectPickerOpen(false); setProjectSheetOpen(true); }}><Text style={[styles.body, (!access.canCreateRecords) && styles.disabledButtonText]}>+ New project</Text></Pressable>}
          onClose={() => setProjectPickerOpen(false)}
          onSelect={(projectId) => { setSelectedProjectId(projectId); setSelectedTaskId(null); setProjectPickerOpen(false); void getWorkStore(userId).then((store) => store.listTasks(userId, projectId)).then(setTasks); }}
          projects={projects.filter((project) => project.status !== "archived")}
          testID="today-project-picker-sheet"
        /> : null}
        {projectSheetOpen ? <ProjectNameSheet onClose={() => setProjectSheetOpen(false)} onSave={async (name) => {
          if (!access.canCreateRecords) throw new Error(access.message);
          const store = await getWorkStore(userId);
          const clients = await store.listClients(userId);
          const client = clients[0] ?? await store.createClient({ userId, name: "My client" });
          const project = await store.createProject({ userId, clientId: client.id, name, hourlyRateCents: 0 });
          await refreshWorkState(); setSelectedProjectId(project.id); setProjectPickerOpen(false);
        }} /> : null}
        {taskPickerOpen && activeProject ? <TaskPickerSheet tasks={tasks} selectedId={selectedTaskId} onClose={() => setTaskPickerOpen(false)} onSelect={(id) => void handleSwitchTask(id)} onAdd={handleAddTask} /> : null}
        {noteOpen && homeState?.activeEntry ? <NoteSheet initialValue={homeState.activeEntry.locationNote ?? ""} readOnly={false} onClose={() => setNoteOpen(false)} onSave={async (note) => { const store = await getWorkStore(userId); await store.saveLocationNote({ userId, entryId: homeState.activeEntry!.id, note }); await refreshWorkState(); }} /> : null}
      </View>
    </View>
  );
}

async function getWorkStore(userId: string) {
  if (Platform.OS === "web") {
    const { webWorkStore } = await import("../work/webWorkStore");
    return webWorkStore;
  }

  const { getLocalRepositories } = await import("../db/repositories");
  const repositories = await getLocalRepositories(userId);
  return repositories.work;
}

function parseBreakMinutes(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function getErrorMessage(error: unknown, action: string): string {
  return `Couldn't ${action}. Try again.`;
}
