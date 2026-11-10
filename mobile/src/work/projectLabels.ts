export function projectPickerLabel(project: { id: string; name: string; siteAddress?: string | null }, projects: Array<{ id: string; name: string; siteAddress?: string | null }>): string {
  const matches = projects.filter((item) => item.name.trim().toLocaleLowerCase() === project.name.trim().toLocaleLowerCase());
  if (matches.length < 2) return project.name;
  if (project.siteAddress?.trim()) return `${project.name} · ${project.siteAddress.trim()}`;
  return `${project.name} · ${matches.findIndex((item) => item.id === project.id) + 1}`;
}
