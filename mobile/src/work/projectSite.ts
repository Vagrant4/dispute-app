import type { ProjectSummary } from "./workRepository";

export function formatProjectSite(site: Pick<ProjectSummary, "lastSiteAddress" | "lastSiteLatitude" | "lastSiteLongitude" | "lastSiteAccuracyM"> | null): string {
  if (site?.lastSiteAddress?.trim()) return site.lastSiteAddress.trim();
  if (site?.lastSiteLatitude == null || site.lastSiteLongitude == null) return "No GPS site recorded";
  const accuracy = site.lastSiteAccuracyM;
  return accuracy != null && Number.isFinite(accuracy) && accuracy >= 0
    ? `GPS site ±${Math.round(accuracy)}m`
    : "GPS site";
}
