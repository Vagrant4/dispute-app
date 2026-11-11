import * as Location from "expo-location";
import { MaterialIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { LocalAccount } from "../auth/localAuth";
import type { ProjectSummary } from "../work/workRepository";
import {
  currentWeekStart,
  getProjectScreenStore,
} from "../work/projectScreenStore";
import { useSubscriptionAccess } from "../subscription/useSubscriptionAccess";
import {
  filterProjects,
  formatSiteDistance,
  haversineMetres,
  type ProjectStatus,
} from "../work/projectDiscovery";
import { styles, theme } from "../styles";
import { projectAddressLabel } from "../work/projectAddress";
import { ProjectNameSheet } from "./ProjectNameSheet";
import { ProjectDetailScreen } from "./ProjectDetailScreen";
import { SwipeDownSheet } from "../components/SwipeDownSheet";

export function voiceSearchErrorMessage(code?: string) {
  switch (code) {
    case "no-speech": return "Didn't catch that. Try again.";
    case "not-allowed": return "Microphone permission needed for voice search.";
    case "audio-capture": return "Microphone permission needed for voice search.";
    case "language-not-supported":
    case "network":
    case "service-not-allowed":
    case "busy": return "Voice search unavailable on this phone.";
    default: return "Voice search unavailable on this phone.";
  }
}

export function ProjectsScreen({
  account,
  onCreateAccount,
  onOpenPlanBilling,
  onSeePhotos: _onSeePhotos,
  onBack,
}: {
  account: LocalAccount;
  onCreateAccount: () => void;
  onOpenPlanBilling?: () => void;
  onSeePhotos: (projectId: string) => void;
  onBack?: () => void;
}) {
  useFonts(MaterialIcons.font);
  const userId = account.id ?? account.email.trim().toLowerCase();
  const access = useSubscriptionAccess(account);
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [query, setQuery] = useState("");
  const [speechAvailable] = useState(() =>
    ExpoSpeechRecognitionModule.isRecognitionAvailable(),
  );
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState(
    speechAvailable ? "" : "Voice search is unavailable on this device.",
  );
  const [statusFilter, setStatusFilter] = useState<
    ProjectStatus | "all" | "archived"
  >("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [position, setPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [newProjectSiteNotice, setNewProjectSiteNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) setQuery(transcript);
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    setSpeechError(voiceSearchErrorMessage(event.error));
  });

  async function toggleVoiceSearch() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      setListening(false);
      return;
    }
    setSpeechError("");
    const permission =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setSpeechError("Microphone permission needed for voice search.");
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true });
    setListening(true);
  }

  async function refresh() {
    try {
      const store = await getProjectScreenStore(userId);
      setSummaries(await store.listProjectSummaries(userId, currentWeekStart()));
    } catch {
      setError("Could not load projects.");
    }
  }
  useEffect(() => {
    let mounted = true;
    void refresh();
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) return;
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown && mounted) setPosition(lastKnown.coords);

        let timeout: ReturnType<typeof setTimeout> | undefined;
        const fresh = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => {
            timeout = setTimeout(() => resolve(null), 10_000);
          }),
        ]);
        if (timeout) clearTimeout(timeout);
        if (fresh && mounted) setPosition(fresh.coords);
      } catch {
        // A cached location, if available, still keeps distance useful offline.
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (creating) {
          setCreating(false);
          return true;
        }
        if (openProjectId) {
          setOpenProjectId(null);
          void refresh();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [creating, openProjectId]);

  async function create(name: string, address: string) {
    if (!access.canCreateRecords) throw new Error(access.message);
    const store = await getProjectScreenStore(userId);
    const clients = await store.listClients(userId);
    const client =
      clients[0] ?? (await store.createClient({ userId, name: "My client" }));
    const geocoded = address
      ? (await Location.geocodeAsync(address).catch(() => []))[0]
      : undefined;
    const project = await store.createProject({
      userId,
      clientId: client.id,
      name,
      hourlyRateCents: 0,
      siteAddress: address,
      siteLatitude: geocoded?.latitude,
      siteLongitude: geocoded?.longitude,
    });
    await refresh();
    setNewProjectSiteNotice(
      address && !geocoded
        ? "Address saved. Couldn't locate it on the map, so distance isn't shown."
        : "",
    );
    setOpenProjectId(project.id);
  }
  const visible = useMemo(() => {
    const rows = summaries.filter((project) =>
      statusFilter === "archived"
        ? project.status === "archived"
        : project.status !== "archived",
    );
    return filterProjects(
      rows,
      query,
      statusFilter === "archived" ? "all" : statusFilter,
    );
  }, [summaries, query, statusFilter]);
  if (openProjectId)
    return (
      <ProjectDetailScreen
        key={openProjectId}
        account={account}
        projectId={openProjectId}
        onCreateAccount={onCreateAccount}
        onOpenPlanBilling={onOpenPlanBilling}
        initialSiteNotice={newProjectSiteNotice}
        onSelectProject={(nextProjectId) => {
          setOpenProjectId(nextProjectId || null);
          setNewProjectSiteNotice("");
          if (!nextProjectId) void refresh();
        }}
      />
    );
  const card = (project: ProjectSummary) => {
    const distance = formatSiteDistance(
      haversineMetres(
        position,
        project.siteLatitude != null && project.siteLongitude != null
          ? { latitude: project.siteLatitude, longitude: project.siteLongitude }
          : null,
      ),
    );
    return (
      <Pressable
        accessibilityRole="button"
        key={project.id}
        onPress={() => setOpenProjectId(project.id)}
        style={styles.projectListCard}
      >
        {project.latestPhotoUri ? (
          <Image
            source={{ uri: project.latestPhotoUri }}
            style={styles.projectListThumb}
          />
        ) : (
          <View style={styles.projectListPlaceholder}>
            <Text style={styles.projectListPlaceholderText}>▧</Text>
          </View>
        )}
        <View style={styles.projectListBody}>
          <Text numberOfLines={1} style={styles.heading}>
            {project.name}
          </Text>
          <Text numberOfLines={1} style={styles.muted}>
            {projectAddressLabel(project.siteAddress)}
          </Text>
          <View style={styles.projectStatusBadge}>
            <View
              style={[
                styles.projectStatusDot,
                project.status === "archived"
                  ? styles.projectStatusArchived
                  : project.projectStatus === "lead"
                  ? styles.projectStatusLead
                  : project.projectStatus === "completed"
                    ? styles.projectStatusCompleted
                    : styles.projectStatusActive,
              ]}
              testID={`project-status-dot-${project.id}`}
            />
            <Text
              testID={`project-status-text-${project.id}`}
              style={[
                styles.projectStatusText,
                project.status === "archived" && styles.projectStatusArchivedText,
              ]}
            >
              {project.status === "archived"
                ? "Archived"
                : project.projectStatus[0].toUpperCase() + project.projectStatus.slice(1)}
            </Text>
          </View>
        </View>
        {project.status === "archived" ? (
          <Pressable
            accessibilityRole="button"
            onPress={async (event) => {
              event?.stopPropagation();
              const store = await getProjectScreenStore(userId);
              await store.setProjectStatus(userId, project.id, "active");
              await refresh();
            }}
            style={styles.chip}
          >
            <Text style={styles.chipText}>Restore</Text>
          </Pressable>
        ) : distance ? (
          <Text style={styles.projectDistance}>{distance}</Text>
        ) : null}
      </Pressable>
    );
  };
  return (
    <View style={styles.projectsPage}>
      <View style={styles.projectsTitleRow}>
        {onBack ? (
          <Pressable accessibilityLabel="Back to Today" onPress={onBack} style={styles.projectsIconButton}>
            <MaterialIcons name="arrow-back" size={28} color={theme.colors.text} />
          </Pressable>
        ) : null}
        <Text style={styles.screenTitle}>Projects</Text>
      </View>
      <>
          <View style={styles.projectSearchRow}>
            <View style={styles.projectSearchContainer}>
              <TextInput
                accessibilityLabel="Search projects"
                onChangeText={(value) => { setQuery(value); setSpeechError(""); }}
                placeholder="Search name or address"
                placeholderTextColor={theme.colors.placeholder}
                style={styles.projectSearch}
                value={query}
              />
              {speechAvailable ? (
                <Pressable
                  accessibilityLabel="Search projects by voice"
                  accessibilityState={{ selected: listening }}
                  onPress={() => void toggleVoiceSearch()}
                  style={styles.projectMicButton}
                >
                  <MaterialIcons
                    name="mic"
                    size={24}
                    color={listening ? theme.colors.primary : theme.colors.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel="Filter projects"
              onPress={() => setFilterOpen(true)}
              style={styles.projectFilterButton}
            >
              <MaterialIcons name="tune" size={26} color={theme.colors.text} />
            </Pressable>
          </View>
          {speechError ? <Text style={styles.muted}>{speechError}</Text> : null}
          {error ? <Text style={styles.body}>{error}</Text> : null}
          {visible.map(card)}
          {!visible.length ? (
            <Text style={styles.muted}>No matching projects.</Text>
          ) : null}
          <Pressable
            disabled={!access.canCreateRecords}
            onPress={() => setCreating(true)}
            style={styles.actionButtonSecondary}
          >
            <Text style={styles.actionButtonSecondaryText}>+ Add project</Text>
          </Pressable>
      </>
      {creating ? (
        <ProjectNameSheet onSave={create} onClose={() => setCreating(false)} />
      ) : null}
      <SwipeDownSheet
        visible={filterOpen}
        backdropStyle={styles.projectSheetBackdrop}
        sheetStyle={styles.projectSheet}
        onClose={() => setFilterOpen(false)}
      >
        <Text style={styles.heading}>Filter projects</Text>
        <Text style={styles.inputLabel}>Status</Text>
        <View style={styles.chipRow}>
          {(["all", "lead", "active", "completed", "archived"] as const).map(
            (value) => (
              <Pressable
                key={value}
                onPress={() => setStatusFilter(value)}
                style={
                  statusFilter === value ? styles.chipSelected : styles.chip
                }
              >
                <Text
                  style={[
                    styles.projectStatusChipText,
                    statusFilter === value
                      ? styles.projectStatusChipTextSelected
                      : styles.projectStatusChipTextUnselected,
                  ]}
                >
                  {value[0].toUpperCase() + value.slice(1)}
                </Text>
              </Pressable>
            ),
          )}
        </View>
      </SwipeDownSheet>
    </View>
  );
}
