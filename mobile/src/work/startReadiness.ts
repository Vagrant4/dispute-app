export function startReadiness({ hasLocation, hasProject }: { hasLocation: boolean; hasProject: boolean }): { ready: boolean; missing: "location" | "project" | "both" | null; hint: string | null } {
  if (!hasLocation && !hasProject) return { ready: false, missing: "both", hint: "Add location and project to start" };
  if (!hasLocation) return { ready: false, missing: "location", hint: "Add your location to start" };
  if (!hasProject) return { ready: false, missing: "project", hint: "Choose a project to start" };
  return { ready: true, missing: null, hint: null };
}
