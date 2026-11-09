import type { ProjectSummary } from "./workRepository";

export function formatProjectSite(site: Pick<ProjectSummary, "lastSiteAddress" | "lastSiteLatitude" | "lastSiteLongitude" | "lastSiteAccuracyM"> | null): string {
  if (site?.lastSiteAddress?.trim()) return site.lastSiteAddress.trim();
  if (site?.lastSiteLatitude == null || site.lastSiteLongitude == null) return "No GPS site recorded";
  return "GPS";
}
