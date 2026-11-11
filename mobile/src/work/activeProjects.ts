import type { WorkProject } from "./workRepository";

export type ProjectListStore = {
  listProjects(userId: string): Promise<WorkProject[]>;
};

export function selectActiveProjects(projects: WorkProject[]): WorkProject[] {
  return projects.filter((project) => project.status !== "archived");
}

export async function listActiveProjects(store: ProjectListStore, userId: string): Promise<WorkProject[]> {
  return selectActiveProjects(await store.listProjects(userId));
}

export function keepActiveProjectId(projects: WorkProject[], projectId?: string | null): string | null {
  return projectId && projects.some((project) => project.id === projectId) ? projectId : null;
}
