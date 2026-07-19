import { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { styles } from "../styles";
import type { WorkDayType, WorkHomeState, WorkProject } from "../work/workRepository";
import { getOptionalWorkLocationAddress } from "../work/workLocation";

export function HomeScreen() {
  const [clockInAt, setClockInAt] = useState<Date | null>(null);
  const [clockOutAt, setClockOutAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [homeState, setHomeState] = useState<WorkHomeState | null>(null);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [workStatus, setWorkStatus] = useState("Loading local work records...");
  const [locationText, setLocationText] = useState("");
  const [locationGps, setLocationGps] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({ latitude: null, longitude: null });
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [activityText, setActivityText] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [dayType, setDayType] = useState<WorkDayType>("normal");
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);

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

  const clockStatus = clockInAt && !clockOutAt ? "Clocked in" : "Ready";
  const trackedTodayMinutes = homeState?.totalMinutesToday ?? 0;
  const activeProject =
    projects.find((project) => project.id === selectedProjectId) ?? homeState?.project;

  useEffect(() => {
    setProjectName(activeProject?.name ?? "");
    setProjectDescription(activeProject?.description ?? "");
  }, [activeProject?.description, activeProject?.id, activeProject?.name]);

  async function refreshWorkState() {
    try {
      const store = await getWorkStore();
      const [nextState, nextProjects] = await Promise.all([
        store.getHomeState(),
        store.listProjects(),
      ]);
      setHomeState(nextState);
      setProjects(nextProjects);
      if (nextState.activeEntry?.startTime) {
        setSelectedProjectId(nextState.activeEntry.projectId);
        setClockInAt(new Date(nextState.activeEntry.startTime));
        setClockOutAt(null);
        setLocationText(nextState.activeEntry.locationText ?? "");
        setLocationGps({
          latitude: nextState.activeEntry.clockInGpsLatitude,
          longitude: nextState.activeEntry.clockInGpsLongitude,
        });
      } else {
        setClockInAt(null);
        setClockOutAt(null);
        setLocationGps({ latitude: null, longitude: null });
        setSelectedProjectId((current) =>
          nextProjects.some((project) => project.id === current)
            ? current
            : nextState.project?.id ?? nextProjects[0]?.id ?? null,
        );
      }
      setWorkStatus(
        nextProjects.length
          ? "Local work records are ready on this device."
          : "No project yet. Enter your project detail below, then tap Create Project.",
      );
    } catch (error) {
      setWorkStatus(getErrorMessage(error));
    }
  }

  async function handleClockIn() {
    if (!selectedProjectId) {
      setWorkStatus("Create a project before Time In.");
      return;
    }
    const nextClockIn = new Date();
    try {
      const store = await getWorkStore();
      await store.clockIn({
        projectId: selectedProjectId ?? undefined,
        clockInAt: nextClockIn,
        dayType,
        locationText,
        gpsLatitude: locationGps.latitude,
        gpsLongitude: locationGps.longitude,
      });
      setClockInAt(nextClockIn);
      setClockOutAt(null);
      setNow(nextClockIn);
      setWorkStatus("Clock-in saved to local device storage.");
      await refreshWorkState();
    } catch (error) {
      setWorkStatus(getErrorMessage(error));
    }
  }

  async function handleSaveProject() {
    try {
      const store = await getWorkStore();
      if (activeProject) {
        if (!("updateProject" in store) || typeof store.updateProject !== "function") {
          throw new Error("Project editing is unavailable in this runtime.");
        }
        const updated = await store.updateProject({
          projectId: activeProject.id,
          name: projectName,
          description: projectDescription,
        });
        setSelectedProjectId(updated.id);
        setWorkStatus("Project details saved.");
        await refreshWorkState();
        return;
      }

      if (
        !("createClient" in store) ||
        typeof store.createClient !== "function" ||
        !("createProject" in store) ||
        typeof store.createProject !== "function"
      ) {
        throw new Error("Project editing is unavailable in this runtime.");
      }
      const client = await store.createClient({
        name: "Local Client",
      });
      const created = await store.createProject({
        clientId: client.id,
        name: projectName,
        description: projectDescription,
        hourlyRateCents: 0,
        currency: "SGD",
      });
      setSelectedProjectId(created.id);
      setWorkStatus(`Project created locally: ${created.name}`);
      await refreshWorkState();
    } catch (error) {
      setWorkStatus(getErrorMessage(error));
    }
  }

  async function handleLocateMe() {
    try {
      const location = await getOptionalWorkLocationAddress();
      if (location.address) {
        setLocationText(location.address);
        setLocationGps({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        setWorkStatus(`${location.message} You can still edit the address manually.`);
      } else {
        setWorkStatus(location.message);
      }
    } catch (error) {
      setWorkStatus(getErrorMessage(error));
    }
  }

  async function handleClockOut() {
    if (!clockInAt || clockOutAt || !homeState?.activeEntry) {
      return;
    }

    const nextClockOut = new Date();
    try {
      const store = await getWorkStore();
      await store.clockOut({
        entryId: homeState.activeEntry.id,
        clockOutAt: nextClockOut,
        breakMinutes: parseBreakMinutes(breakMinutes),
        activity: activityText,
        gpsLatitude: locationGps.latitude,
        gpsLongitude: locationGps.longitude,
      });
      setClockOutAt(nextClockOut);
      setNow(nextClockOut);
      setWorkStatus("Clock-out saved. The entry is now available for reports.");
      await refreshWorkState();
    } catch (error) {
      setWorkStatus(getErrorMessage(error));
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (pendingDeleteEntryId !== entryId) {
      setPendingDeleteEntryId(entryId);
      setWorkStatus("Tap Confirm Delete to remove this recent time entry.");
      return;
    }

    try {
      const store = await getWorkStore();
      if (!("deleteEntry" in store) || typeof store.deleteEntry !== "function") {
        throw new Error("Delete time entry is unavailable in this runtime.");
      }
      await store.deleteEntry({ entryId });
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
            <Text style={styles.heading}>Time in / out</Text>
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
            <Text style={styles.metricLabel}>time in</Text>
          </View>
        </View>

        <Text style={styles.inputLabel}>Project</Text>
        <View style={styles.actionRow}>
          {projects.length ? projects.map((project) => {
            const selected = project.id === activeProject?.id;
            const disabled = Boolean(clockInAt && !clockOutAt);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                key={project.id}
                onPress={() => setSelectedProjectId(project.id)}
                style={[
                  selected ? styles.actionButton : styles.actionButtonSecondary,
                  disabled && styles.disabledButton,
                ]}
              >
                <Text
                  style={
                    selected
                      ? styles.actionButtonText
                      : styles.actionButtonSecondaryText
                  }
                >
                  {project.name}
                </Text>
              </Pressable>
            );
          }) : (
            <Text style={styles.muted}>No project yet. Create one below.</Text>
          )}
        </View>

        <View style={styles.inlineFormPanel}>
          <Text style={styles.inputLabel}>
            {activeProject ? "Edit project detail" : "Create project"}
          </Text>
          <TextInput
            accessibilityLabel="Project name"
            onChangeText={setProjectName}
            placeholder="Enter project name"
            style={styles.textInput}
            value={projectName}
          />
          <TextInput
            accessibilityLabel="Project description"
            multiline
            onChangeText={setProjectDescription}
            placeholder="Site address, work scope, or reference"
            style={[styles.textInput, styles.textAreaSmall]}
            value={projectDescription}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleSaveProject()}
            style={styles.actionButtonSecondary}
          >
            <Text style={styles.actionButtonSecondaryText}>
              {activeProject ? "Save Project Detail" : "Create Project"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.inputLabel}>Location</Text>
        <View style={styles.locationInputRow}>
          <TextInput
            accessibilityLabel="Location note"
            onChangeText={setLocationText}
            placeholder="Tap Locate or type site address manually"
            style={[styles.textInput, styles.locationTextInput]}
            value={locationText}
          />
          <Pressable
            accessibilityLabel="Locate me"
            accessibilityRole="button"
            onPress={() => void handleLocateMe()}
            style={styles.locationIconButton}
          >
            <Text style={styles.locationIconText}>⌖</Text>
            <Text style={styles.locationIconLabel}>Locate</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>
          {locationGps.latitude != null && locationGps.longitude != null
            ? `GPS attached: ${locationGps.latitude.toFixed(5)}, ${locationGps.longitude.toFixed(5)}`
            : "Manual address is accepted when GPS is unavailable or not needed."}
        </Text>

        <Text style={styles.inputLabel}>Day type</Text>
        <View style={styles.actionRow}>
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
                  disabled && styles.disabledButton,
                ]}
              >
                <Text style={selected ? styles.actionButtonText : styles.actionButtonSecondaryText}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.clockButtonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: Boolean(clockInAt && !clockOutAt) || !selectedProjectId,
            }}
            disabled={Boolean(clockInAt && !clockOutAt) || !selectedProjectId}
            onPress={() => void handleClockIn()}
            style={[
              styles.clockPrimaryButton,
              (clockInAt && !clockOutAt || !selectedProjectId) &&
                styles.disabledButton,
            ]}
          >
            <Text style={styles.clockPrimaryButtonText}>Time In</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !clockInAt || Boolean(clockOutAt) }}
            disabled={!clockInAt || Boolean(clockOutAt)}
            onPress={() => void handleClockOut()}
            style={[
              styles.clockSecondaryButton,
              (!clockInAt || clockOutAt) && styles.disabledButton,
            ]}
          >
            <Text style={styles.clockSecondaryButtonText}>Time Out</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>
          {workStatus}
        </Text>
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
            No saved time entries yet. Clock in to start a local record.
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

async function getWorkStore() {
  if (Platform.OS === "web") {
    const { webWorkStore } = await import("../work/webWorkStore");
    return webWorkStore;
  }

  const { getLocalRepositories } = await import("../db/repositories");
  const repositories = await getLocalRepositories();
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
  return error instanceof Error ? error.message : "Local work action failed.";
}
