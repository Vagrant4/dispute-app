import { useEffect, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

import { styles } from "../styles";
import type { WorkClient, WorkDayType, WorkProject } from "../work/workRepository";
import { getOptionalWorkLocationAddress } from "../work/workLocation";

export function WorkSetupScreen() {
  const [clients, setClients] = useState<WorkClient[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [status, setStatus] = useState("Loading local clients and projects...");
  const [clientName, setClientName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [manualProjectId, setManualProjectId] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualStart, setManualStart] = useState("08:00");
  const [manualEnd, setManualEnd] = useState("17:00");
  const [manualBreak, setManualBreak] = useState("60");
  const [manualDayType, setManualDayType] = useState<WorkDayType>("normal");
  const [manualActivity, setManualActivity] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [manualLocationGps, setManualLocationGps] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({ latitude: null, longitude: null });

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const store = await getWorkStore();
      const [nextClients, nextProjects] = await Promise.all([
        store.listClients(),
        store.listProjects(),
      ]);
      setClients(nextClients);
      setProjects(nextProjects);
      setManualProjectId((current) => current || nextProjects[0]?.id || "");
      setStatus(
        nextProjects.length
          ? "Local work setup is ready."
          : "No project yet. Add your first client and project.",
      );
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleCreateClient() {
    try {
      const store = await getWorkStore();
      const client = await store.createClient({
        name: clientName,
        contactName,
        contactEmail,
      });
      setStatus(`Client saved locally: ${client.name}`);
      setClientName("");
      setContactName("");
      setContactEmail("");
      await refresh();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleCreateProject() {
    const client = clients[0];
    if (!client) {
      setStatus("Create a client before adding a project.");
      return;
    }

    try {
      const store = await getWorkStore();
      const project = await store.createProject({
        clientId: client.id,
        name: projectName,
        description: projectDescription,
        hourlyRateCents: parseHourlyRateCents(hourlyRate),
        currency: "SGD",
      });
      setStatus(`Project saved locally: ${project.name}`);
      setProjectName("");
      setProjectDescription("");
      setHourlyRate("");
      await refresh();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleCreateManualEntry() {
    if (!manualProjectId) {
      setStatus("Create a project before adding manual time.");
      return;
    }
    try {
      const store = await getWorkStore();
      const clockInAt = parseLocalDateTime(manualDate, manualStart);
      const clockOutAt = parseLocalDateTime(manualDate, manualEnd);
      const entry = await store.createManualEntry({
        projectId: manualProjectId,
        clockInAt,
        clockOutAt,
        breakMinutes: Number.parseInt(manualBreak, 10) || 0,
        activity: manualActivity,
        dayType: manualDayType,
        locationText: manualLocation,
        gpsLatitude: manualLocationGps.latitude,
        gpsLongitude: manualLocationGps.longitude,
      });
      setStatus(`Manual entry saved: ${entry.projectName}, ${entry.durationMinutes} minutes.`);
      setManualActivity("");
      await refresh();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function handleLocateManualEntry() {
    try {
      const location = await getOptionalWorkLocationAddress();
      if (location.address) {
        setManualLocation(location.address);
        setManualLocationGps({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        setStatus(`${location.message} You can still edit the manual address.`);
      } else {
        setStatus(location.message);
      }
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  const selectedClient = clients[0];

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Offline setup</Text>
        <Text style={styles.heading}>Clients and projects</Text>
        <Text style={styles.body}>
          Create the job context on this device first. Time entries, photos,
          backups, and reports use these local records.
        </Text>
        <Text style={styles.statusMessage}>{status}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Add client</Text>
        <Text style={styles.inputLabel}>Client / company name</Text>
        <TextInput
          accessibilityLabel="Client company name"
          onChangeText={setClientName}
          placeholder="Client or company name"
          style={styles.textInput}
          value={clientName}
        />
        <Text style={styles.inputLabel}>Contact person</Text>
        <TextInput
          accessibilityLabel="Client contact person"
          onChangeText={setContactName}
          placeholder="Site Supervisor"
          style={styles.textInput}
          value={contactName}
        />
        <Text style={styles.inputLabel}>Contact email</Text>
        <TextInput
          accessibilityLabel="Client contact email"
          autoCapitalize="none"
          inputMode="email"
          onChangeText={setContactEmail}
          placeholder="contact@example.com"
          style={styles.textInput}
          value={contactEmail}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleCreateClient()}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>Save Client</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Add project</Text>
        <Text style={styles.muted}>
          New projects are linked to the newest client:{" "}
          {selectedClient?.name ?? "No client yet"}.
        </Text>
        <Text style={styles.inputLabel}>Project name</Text>
        <TextInput
          accessibilityLabel="Project name"
          onChangeText={setProjectName}
          placeholder="Enter project name"
          style={styles.textInput}
          value={projectName}
        />
        <Text style={styles.inputLabel}>Project description</Text>
        <TextInput
          accessibilityLabel="Project description"
          multiline
          onChangeText={setProjectDescription}
          placeholder="Site address, work order, or scope"
          style={[styles.textInput, styles.textArea]}
          value={projectDescription}
        />
        <Text style={styles.inputLabel}>Hourly rate (SGD)</Text>
        <TextInput
          accessibilityLabel="Project hourly rate"
          inputMode="decimal"
          keyboardType="decimal-pad"
          onChangeText={setHourlyRate}
          placeholder="25"
          style={styles.textInput}
          value={hourlyRate}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleCreateProject()}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>Save Project</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Past work</Text>
        <Text style={styles.heading}>Add manual time entry</Text>
        <Text style={styles.inputLabel}>Project</Text>
        <View style={styles.actionRow}>
          {projects.length ? projects.map((project) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: project.id === manualProjectId }}
              key={project.id}
              onPress={() => setManualProjectId(project.id)}
              style={project.id === manualProjectId ? styles.actionButton : styles.actionButtonSecondary}
            >
              <Text style={project.id === manualProjectId ? styles.actionButtonText : styles.actionButtonSecondaryText}>
                {project.name}
              </Text>
            </Pressable>
          )) : (
            <Text style={styles.muted}>No project yet. Save a project first.</Text>
          )}
        </View>
        <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
        <TextInput accessibilityLabel="Manual work date" onChangeText={setManualDate} style={styles.textInput} value={manualDate} />
        <View style={styles.clockSummary}>
          <View style={styles.clockSummaryItem}>
            <Text style={styles.inputLabel}>Start (HH:MM)</Text>
            <TextInput accessibilityLabel="Manual start time" onChangeText={setManualStart} style={styles.textInput} value={manualStart} />
          </View>
          <View style={styles.clockSummaryItem}>
            <Text style={styles.inputLabel}>End (HH:MM)</Text>
            <TextInput accessibilityLabel="Manual end time" onChangeText={setManualEnd} style={styles.textInput} value={manualEnd} />
          </View>
        </View>
        <Text style={styles.inputLabel}>Break minutes (inclusive)</Text>
        <TextInput accessibilityLabel="Manual break minutes" keyboardType="number-pad" onChangeText={setManualBreak} style={styles.textInput} value={manualBreak} />
        <Text style={styles.inputLabel}>Day type</Text>
        <View style={styles.actionRow}>
          {DAY_TYPE_OPTIONS.map((option) => {
            const selected = option.id === manualDayType;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.id}
                onPress={() => setManualDayType(option.id)}
                style={selected ? styles.actionButton : styles.actionButtonSecondary}
              >
                <Text style={selected ? styles.actionButtonText : styles.actionButtonSecondaryText}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.inputLabel}>Work description</Text>
        <TextInput accessibilityLabel="Manual work description" multiline onChangeText={setManualActivity} style={[styles.textInput, styles.textArea]} value={manualActivity} />
        <Text style={styles.inputLabel}>Location address</Text>
        <View style={styles.locationInputRow}>
          <TextInput
            accessibilityLabel="Manual location address"
            onChangeText={setManualLocation}
            placeholder="Tap Locate or type site address manually"
            style={[styles.textInput, styles.locationTextInput]}
            value={manualLocation}
          />
          <Pressable
            accessibilityLabel="Locate manual entry"
            accessibilityRole="button"
            onPress={() => void handleLocateManualEntry()}
            style={styles.locationIconButton}
          >
            <Text style={styles.locationIconText}>⌖</Text>
            <Text style={styles.locationIconLabel}>Locate</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>
          {manualLocationGps.latitude != null && manualLocationGps.longitude != null
            ? `GPS attached: ${manualLocationGps.latitude.toFixed(5)}, ${manualLocationGps.longitude.toFixed(5)}`
            : "Manual address is accepted when GPS is unavailable or not needed."}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void handleCreateManualEntry()} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Save Manual Entry</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Local clients</Text>
        {clients.length ? (
          <View style={styles.list}>
            {clients.map((client) => (
              <View key={client.id} style={styles.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.rowLabel}>{client.name}</Text>
                  <Text style={styles.muted}>
                    {client.contactName ?? "No contact"} ·{" "}
                    {client.contactEmail ?? "No email"}
                  </Text>
                </View>
                <Text style={styles.rowValue}>{client.status}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>No local clients yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Local projects</Text>
        {projects.length ? (
          <View style={styles.list}>
            {projects.map((project) => (
              <View key={project.id} style={styles.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.rowLabel}>{project.name}</Text>
                  <Text style={styles.muted}>
                    {project.clientName} · {project.currency}{" "}
                    {formatMoney(project.hourlyRateCents)}/hr
                  </Text>
                  {project.description ? (
                    <Text style={styles.body}>{project.description}</Text>
                  ) : null}
                </View>
                <Text style={styles.rowValue}>{project.status}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>No local projects yet.</Text>
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

function parseHourlyRateCents(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Work setup action failed.";
}

function parseLocalDateTime(date: string, time: string): Date {
  const value = new Date(`${date}T${time}:00`);
  if (Number.isNaN(value.getTime())) {
    throw new Error("Enter a valid date and 24-hour time.");
  }
  return value;
}
