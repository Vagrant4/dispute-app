import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import { BackHandler, Image, Pressable, Text, TextInput, View } from "react-native";
import type { LocalAccount } from "../auth/localAuth";
import type { ProjectGroup, ProjectSummary } from "../work/workRepository";
import { currentWeekStart, getProjectScreenStore } from "../work/projectScreenStore";
import { useSubscriptionAccess } from "../subscription/useSubscriptionAccess";
import { filterProjects, formatSiteDistance, haversineMetres, type ProjectStatus } from "../work/projectDiscovery";
import { styles, theme } from "../styles";
import { ProjectNameSheet } from "./ProjectNameSheet";
import { ProjectDetailScreen } from "./ProjectDetailScreen";
import { SwipeDownSheet } from "../components/SwipeDownSheet";

type ProjectStore = Awaited<ReturnType<typeof getProjectScreenStore>> & { listProjectGroups?: (userId: string) => Promise<ProjectGroup[]>; addProjectGroup?: (userId: string, name: string) => Promise<ProjectGroup> };

export function ProjectsScreen({ account, onCreateAccount, onOpenPlanBilling, onSeePhotos: _onSeePhotos, onBack }: { account: LocalAccount; onCreateAccount: () => void; onOpenPlanBilling?: () => void; onSeePhotos: (projectId: string) => void; onBack?: () => void }) {
  const userId = account.id ?? account.email.trim().toLowerCase();
  const access = useSubscriptionAccess(account);
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [tab, setTab] = useState<"projects" | "groups">("projects");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all" | "archived">("all");
  const [groupFilter, setGroupFilter] = useState<string | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const store = await getProjectScreenStore(userId) as ProjectStore;
      const [nextProjects, nextGroups] = await Promise.all([store.listProjectSummaries(userId, currentWeekStart()), store.listProjectGroups?.(userId) ?? Promise.resolve([])]);
      setSummaries(nextProjects); setGroups(nextGroups);
    } catch { setError("Could not load projects."); }
  }
  useEffect(() => { void refresh(); void Location.requestForegroundPermissionsAsync().then((permission) => permission.granted ? Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }) : null).then((reading) => { if (reading) setPosition(reading.coords); }).catch(() => undefined); }, [userId]);
  useEffect(() => { const subscription = BackHandler.addEventListener("hardwareBackPress", () => { if (creating) { setCreating(false); return true; } if (openProjectId) { setOpenProjectId(null); void refresh(); return true; } return false; }); return () => subscription.remove(); }, [creating, openProjectId]);

  async function create(name: string, address: string) {
    if (!access.canCreateRecords) throw new Error(access.message);
    const store = await getProjectScreenStore(userId);
    const clients = await store.listClients(userId);
    const client = clients[0] ?? await store.createClient({ userId, name: "My client" });
    const geocoded = address ? (await Location.geocodeAsync(address).catch(() => []))[0] : undefined;
    const project = await store.createProject({ userId, clientId: client.id, name, hourlyRateCents: 0, siteAddress: address, siteLatitude: geocoded?.latitude, siteLongitude: geocoded?.longitude });
    await refresh(); setOpenProjectId(project.id);
  }
  async function addGroup() { const name = groupName.trim(); if (!name) return; const store = await getProjectScreenStore(userId) as ProjectStore; await store.addProjectGroup?.(userId, name); setGroupName(""); setGroupOpen(false); await refresh(); }

  const visible = useMemo(() => {
    const rows = summaries.filter((project) => statusFilter === "archived" ? project.status === "archived" : project.status !== "archived");
    return filterProjects(rows, query, statusFilter === "archived" ? "all" : statusFilter, groupFilter);
  }, [summaries, query, statusFilter, groupFilter]);
  if (openProjectId) return <ProjectDetailScreen key={openProjectId} account={account} projectId={openProjectId} onCreateAccount={onCreateAccount} onOpenPlanBilling={onOpenPlanBilling} onSelectProject={(nextProjectId) => { setOpenProjectId(nextProjectId || null); if (!nextProjectId) void refresh(); }} />;
  const card = (project: ProjectSummary) => {
    const distance = formatSiteDistance(haversineMetres(position, project.siteLatitude != null && project.siteLongitude != null ? { latitude: project.siteLatitude, longitude: project.siteLongitude } : null));
    return <Pressable accessibilityRole="button" key={project.id} onPress={() => setOpenProjectId(project.id)} style={styles.projectListCard}>
      {project.latestPhotoUri ? <Image source={{ uri: project.latestPhotoUri }} style={styles.projectListThumb} /> : <View style={styles.projectListPlaceholder}><Text style={styles.projectListPlaceholderText}>▧</Text></View>}
      <View style={styles.projectListBody}><Text numberOfLines={1} style={styles.heading}>{project.name}</Text>{project.siteAddress ? <Text numberOfLines={1} style={styles.muted}>{project.siteAddress}</Text> : null}<View style={styles.projectStatusBadge}><View style={[styles.projectStatusDot, project.projectStatus === "lead" ? styles.projectStatusLead : project.projectStatus === "completed" ? styles.projectStatusCompleted : styles.projectStatusActive]} /><Text style={styles.projectStatusText}>{project.projectStatus[0].toUpperCase() + project.projectStatus.slice(1)}</Text></View></View>
      {project.status === "archived" ? <Pressable accessibilityRole="button" onPress={async (event) => { event.stopPropagation(); const store = await getProjectScreenStore(userId); await store.setProjectStatus(userId, project.id, "active"); await refresh(); }} style={styles.chip}><Text style={styles.chipText}>Restore</Text></Pressable> : distance ? <Text style={styles.projectDistance}>{distance}</Text> : null}
    </Pressable>;
  };
  return <View style={styles.projectsPage}>
    <View style={styles.projectsTitleRow}>{onBack ? <Pressable accessibilityLabel="Back to Today" onPress={onBack}><Text style={styles.projectsBack}>‹</Text></Pressable> : null}<Text style={styles.screenTitle}>Projects</Text></View>
    <View style={styles.projectTabs}>{(["projects", "groups"] as const).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.projectTab, tab === item && styles.projectTabSelected]}><Text style={tab === item ? styles.projectTabTextSelected : styles.projectTabText}>{item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>
    {tab === "projects" ? <><View style={styles.projectSearchRow}><TextInput accessibilityLabel="Search projects" onChangeText={setQuery} placeholder="Search name or address" placeholderTextColor={theme.colors.placeholder} style={styles.projectSearch} value={query} /><Pressable accessibilityLabel="Filter projects" onPress={() => setFilterOpen(true)} style={styles.projectFilterButton}><Text style={styles.heading}>≡</Text></Pressable></View>{error ? <Text style={styles.body}>{error}</Text> : null}{visible.map(card)}{!visible.length ? <Text style={styles.muted}>No matching projects.</Text> : null}<Pressable disabled={!access.canCreateRecords} onPress={() => setCreating(true)} style={styles.actionButtonSecondary}><Text style={styles.actionButtonSecondaryText}>+ Add project</Text></Pressable></> : <><Pressable onPress={() => setGroupOpen(true)} style={styles.actionButtonSecondary}><Text style={styles.actionButtonSecondaryText}>+ Add group</Text></Pressable>{groups.map((group) => <View key={group.id} style={styles.projectGroup}><Text style={styles.heading}>{group.name}</Text>{summaries.filter((project) => project.groupId === group.id).map(card)}{!summaries.some((project) => project.groupId === group.id) ? <Text style={styles.muted}>No projects assigned.</Text> : null}</View>)}</>}
    {creating ? <ProjectNameSheet onSave={create} onClose={() => setCreating(false)} /> : null}
    <SwipeDownSheet visible={filterOpen} backdropStyle={styles.projectSheetBackdrop} sheetStyle={styles.projectSheet} onClose={() => setFilterOpen(false)}><Text style={styles.heading}>Filter projects</Text><Text style={styles.inputLabel}>Status</Text><View style={styles.chipRow}>{(["all", "lead", "active", "completed", "archived"] as const).map((value) => <Pressable key={value} onPress={() => setStatusFilter(value)} style={statusFilter === value ? styles.chipSelected : styles.chip}><Text style={statusFilter === value ? styles.selectedSecondaryText : styles.chipText}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}</View><Text style={styles.inputLabel}>Group</Text><View style={styles.chipRow}>{[{ id: "all", name: "All" }, ...groups].map((group) => <Pressable key={group.id} onPress={() => setGroupFilter(group.id)} style={groupFilter === group.id ? styles.chipSelected : styles.chip}><Text style={groupFilter === group.id ? styles.selectedSecondaryText : styles.chipText}>{group.name}</Text></Pressable>)}</View></SwipeDownSheet>
    <SwipeDownSheet visible={groupOpen} backdropStyle={styles.projectSheetBackdrop} sheetStyle={styles.projectSheet} onClose={() => setGroupOpen(false)}><Text style={styles.heading}>Add group</Text><TextInput accessibilityLabel="Group name" onChangeText={setGroupName} placeholder="Group name" placeholderTextColor={theme.colors.placeholder} style={styles.textInput} value={groupName} /><Pressable onPress={() => void addGroup()} style={styles.actionButtonSecondary}><Text style={styles.actionButtonSecondaryText}>Save group</Text></Pressable></SwipeDownSheet>
  </View>;
}
