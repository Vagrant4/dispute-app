export function startReadiness({ hasLocation, hasProject }: { hasLocation: boolean; hasProject: boolean }): { enabled: boolean; hint: string | null } {
  if (!hasLocation && !hasProject) return { enabled: false, hint: "Add location and project to start" };
  if (!hasLocation) return { enabled: false, hint: "Add your location to start" };
  if (!hasProject) return { enabled: false, hint: "Choose a project to start" };
  return { enabled: true, hint: null };
}
