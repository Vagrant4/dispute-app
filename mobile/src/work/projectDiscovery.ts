export type ProjectStatus = "active" | "completed";

export type DiscoverableProject = {
  name: string;
  siteAddress: string | null;
  projectStatus: ProjectStatus;
  groupId: string | null;
};

export function normalizeProjectStatus(status: string | null | undefined): ProjectStatus {
  return status === "completed" ? "completed" : "active";
}

export function formatSiteDistance(metres: number | null | undefined): string | null {
  if (metres == null || !Number.isFinite(metres) || metres < 0) return null;
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export function haversineMetres(from: { latitude: number; longitude: number } | null, to: { latitude: number; longitude: number } | null): number | null {
  if (!from || !to) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function filterProjects<T extends DiscoverableProject>(projects: T[], query: string, status?: ProjectStatus | "all"): T[] {
  const needle = query.trim().toLocaleLowerCase();
  return projects.filter((project) => (!needle || `${project.name} ${project.siteAddress ?? ""}`.toLocaleLowerCase().includes(needle))
    && (!status || status === "all" || normalizeProjectStatus(project.projectStatus) === status));
}
