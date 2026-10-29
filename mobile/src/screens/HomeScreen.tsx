import { defaultDayType } from "../work/defaultDayType";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  Text,
  Linking,
  View,
} from "react-native";

import { ProjectNameSheet } from "./ProjectNameSheet";
import { styles } from "../styles";
import { useSubscriptionAccess } from "../subscription/useSubscriptionAccess";
import type { WorkDayType, WorkHomeState, WorkProject } from "../work/workRepository";
import { locationReading, type LocationReading } from "../work/locationEvidence";
import { getWorkLocationWithTimeout } from "../work/workLocation";
import { formatIdleClock, formatWorkedClock, workedSecondsToday, formatClockTime, formatLocationRow } from "../work/todayDisplay";
import { startReadiness } from "../work/startReadiness";
import type { LocalAccount } from "../auth/localAuth";

export function HomeScreen({ account, onCreateAccount }: { account: LocalAccount; onCreateAccount: () => void }) {
  const locationRequest = useRef(0);
  const pendingLocations = useRef<LocationReading[]>([]);
  const [locationOff, setLocationOff] = useState(false);
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
  const [locationEntryId, setLocationEntryId] = useState<string | null>(null);
  const [locationPhase, setLocationPhase] = useState<"start" | "stop">("start");
  const [stopping, setStopping] = useState(false);
  const [activityText, setActivityText] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [dayType, setDayType] = useState<WorkDayType>(() => defaultDayType(new Date()));
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), clockInAt && !clockOutAt ? 1000 : 15_000);
    return () => clearInterval(timer);
  }, [clockInAt, clockOutAt]);

  useEffect(() => {
    void refreshWorkState();
  }, []);

  const activeProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId) ?? null
    : null;
  const isRunning = Boolean(clockInAt && !clockOutAt);
  const readiness = startReadiness({ hasLocation: locationFix?.source === "gps", hasProject: Boolean(activeProject) });
  const startDisabled = isRunning ? stopping : !access.canCreateRecords;
  const idleClock = formatIdleClock(now);
  const workedSeconds = workedSecondsToday(homeState?.totalMinutesToday ?? 0, isRunning ? clockInAt : null, now);
  const locationRow = formatLocationRow(locationFix, { working: isRunning, locating, locationOff });
  const trialDaysLeft = account.isGuest ? access.trialDaysLeft : access.subscription?.status === "TRIALING" && access.subscription.trialEndsAt
    ? Math.ceil((Date.parse(access.subscription.trialEndsAt) - now.getTime()) / 86400000) : null;
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
      }
    } catch (error) {
      setWorkStatus(getErrorMessage(error));
    }
  }

  async function handleClockIn() {
    if (savingStart.current) return;
    if (readiness.missing === "location" || readiness.missing === "both") {
      if (locationOff) void Linking.openSettings();
      else await handleLocateMe();
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
      const entry = await store.clockIn({ userId, projectId, clockInAt: nextClockIn, dayType });
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
      setWorkStatus(getErrorMessage(error));
    } finally { savingStart.current = false; }
  }

  async function handleLocateMe() {
    if (isRunning || locating || stopping) return;
    const request = ++locationRequest.current;
    setLocating(true);
    try {
      const location = await getWorkLocationWithTimeout(20_000);
      if (request !== locationRequest.current) return;
      const store = await getWorkStore(userId);
      const canRefreshEntry = locationEntryId && (locationPhase === "start" || (clockOutAt && now.getTime() - clockOutAt.getTime() <= 600_000));
      const params = { userId, entryId: locationEntryId!, phase: locationPhase, locationText: location?.address ?? undefined, addressParts: location?.addressParts, gpsLatitude: location?.latitude ?? null, gpsLongitude: location?.longitude ?? null, gpsAccuracyM: location?.accuracy ?? null, locatedAt: location?.timestamp ?? null };
      const fix = locationReading(params, canRefreshEntry ? locationPhase : "start");
      setLocationOff(fix.source !== "gps");
      if (canRefreshEntry) await store.refreshLocation(params);
      else if (fix.source === "gps") pendingLocations.current.push(fix);
      setLocationFix(fix);
    } catch (error) { setWorkStatus(getErrorMessage(error)); }
    finally { if (request === locationRequest.current) setLocating(false); }
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
      setLocationFix(locationReading({ locationText: location?.address ?? undefined, addressParts: location?.addressParts, gpsLatitude: location?.latitude, gpsLongitude: location?.longitude, gpsAccuracyM: location?.accuracy, locatedAt: location?.timestamp }, "stop"));
      setClockOutAt(nextClockOut);
      setDayType(defaultDayType(nextClockOut));
      setNow(nextClockOut);
      setWorkStatus("");
      await refreshWorkState();
    } catch (error) {
      setWorkStatus(getErrorMessage(error));
    } finally { setLocating(false); setStopping(false); }
  }

  return (
    <View style={styles.todayScreen}>
      <View style={styles.todayHeader}>
        <Text style={styles.todayTitle}>Today</Text>
        <Text style={styles.todayWordmark}>DISPUTE</Text>
      </View>
      <View style={styles.todayHero}>
        <View style={[styles.todayStatus, isRunning && styles.todayStatusWorking]}>
          <View style={[styles.todayStatusDot, isRunning && styles.todayStatusDotWorking]} />
          <Text style={[styles.todayStatusText, isRunning && styles.todayStatusTextWorking]}>{isRunning && clockInAt ? `Working · since ${formatClockTime(clockInAt)}` : "Not clocked in"}</Text>
        </View>
        <Text style={styles.todayClock}>{isRunning ? formatWorkedClock(workedSeconds) : idleClock.time}{!isRunning ? <Text style={styles.todayPeriod}> {idleClock.period}</Text> : null}</Text>
        <Text style={styles.todayCaption}>{isRunning ? "hours worked today" : now.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" })}</Text>
        {trialDaysLeft != null && trialDaysLeft > 0 && trialDaysLeft <= 3 ? <Text style={styles.todayTrial}>{trialDaysLeft} days left in your free trial</Text> : null}
        <View style={styles.todayButtonFrame}>
          <View style={[styles.todayHalo, isRunning && styles.todayStopHalo]}>
            <Pressable hitSlop={isRunning ? 8 : 0} accessibilityRole="button" accessibilityLabel={isRunning ? "Clock out" : "Clock in"} accessibilityState={{ disabled: startDisabled }} disabled={startDisabled} onPress={() => void (isRunning ? handleClockOut() : handleClockIn())} style={[styles.todayRoundButton, isRunning && styles.todayStopButton, startDisabled && styles.disabledButton]}>
              <Text style={[styles.todayRoundText, isRunning && styles.todayStopText, startDisabled && styles.disabledButtonText]}>{isRunning ? "Clock out" : "Clock in"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View style={styles.todayRows}>
        <Pressable accessibilityRole="button" accessibilityLabel="Get location" accessibilityState={{ disabled: isRunning || locating || stopping }} disabled={isRunning || locating || stopping} onPress={() => { if (locationOff) void Linking.openSettings(); else void handleLocateMe(); }} style={styles.todayEvidenceRow}>
          <View style={styles.todayIconTile}><Image source={require("../../assets/icons/pin.png")} style={styles.todayRowIcon} /></View>
          <View style={styles.todayRowContent}>
            <Text numberOfLines={1} style={styles.todayRowTitle}>{locationRow.title}</Text>
            <View style={styles.todaySubtitleRow}>{isRunning ? <Image source={require("../../assets/icons/lock.png")} style={styles.todayLockIcon} /> : null}<Text style={styles.todayRowSubtitle}>{locationRow.subtitle}</Text></View>
          </View>
          {!isRunning ? <Text style={styles.todayChevron}>›</Text> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={activeProject?.name ?? "Choose a project"} accessibilityState={{ disabled: isRunning }} disabled={isRunning} onPress={() => setProjectPickerOpen(!projectPickerOpen)} style={styles.todayEvidenceRow}>
          <View style={styles.todayIconTile}><Image source={require("../../assets/icons/briefcase.png")} style={styles.todayRowIcon} /></View>
          <View style={styles.todayRowContent}>
            <Text numberOfLines={1} style={styles.todayRowTitle}>{activeProject?.name ?? "Choose a project"}</Text>
            <View style={styles.todaySubtitleRow}>{isRunning ? <Image source={require("../../assets/icons/lock.png")} style={styles.todayLockIcon} /> : null}<Text style={styles.todayRowSubtitle}>{isRunning ? "Locked during shift" : activeProject ? "Tap to change" : "Tap to choose"}</Text></View>
          </View>
          {!isRunning ? <Text style={styles.todayChevron}>›</Text> : null}
        </Pressable>
      </View>
      <View>
        {projectPickerOpen ? <View style={styles.todayPicker}>{projects.filter((project) => project.status !== "archived").map((project) => <Pressable key={project.id} onPress={() => { setSelectedProjectId(project.id); setProjectPickerOpen(false); }}><Text style={styles.body}>{project.name}</Text></Pressable>)}<Pressable style={[(!access.canCreateRecords) && styles.disabledButton]} disabled={!access.canCreateRecords} onPress={() => setProjectSheetOpen(true)}><Text style={[styles.body, (!access.canCreateRecords) && styles.disabledButtonText]}>+ New project</Text></Pressable></View> : null}
        {projectSheetOpen ? <ProjectNameSheet onClose={() => setProjectSheetOpen(false)} onSave={async (name) => {
          if (!access.canCreateRecords) throw new Error(access.message);
          const store = await getWorkStore(userId);
          const clients = await store.listClients(userId);
          const client = clients[0] ?? await store.createClient({ userId, name: "My client" });
          const project = await store.createProject({ userId, clientId: client.id, name, hourlyRateCents: 0 });
          await refreshWorkState(); setSelectedProjectId(project.id); setProjectPickerOpen(false);
        }} /> : null}
        {workStatus ? <Text style={styles.muted}>{workStatus}</Text> : null}
        {access.subscription && !access.canCreateRecords ? (
          <View style={styles.todayPicker}>
            <Text style={styles.heading}>{account.isGuest ? "Your 30-day free trial has ended." : "Your trial or subscription is not active."}</Text>
            <Text style={styles.body}>{account.isGuest
              ? "Create a free account to keep your records, then subscribe to continue logging and exporting. All your records stay viewable."
              : "Subscribe in Settings > Plan & billing to continue logging and exporting. All your records stay viewable."}</Text>
            {clockInAt && !clockOutAt ? <Text style={styles.body}>You can still tap Clock out to finish the current shift.</Text> : null}
            {account.isGuest ? <Pressable accessibilityRole="button" onPress={onCreateAccount} style={styles.actionButtonSecondary}><Text style={styles.actionButtonSecondaryText}>Create account</Text></Pressable> : null}
          </View>
        ) : null}
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

function getErrorMessage(error: unknown): string {
  return "Something went wrong. Please try again.";
}
