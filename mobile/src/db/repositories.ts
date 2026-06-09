import { openAndInitializeLocalDatabase } from "./localDatabase";
import { SettingsRepository, type RepositoryHealth } from "./settingsRepository";

export type LocalRepositories = {
  settings: SettingsRepository;
  getHealth: () => Promise<RepositoryHealth>;
};

let cachedRepositories: LocalRepositories | null = null;

export async function getLocalRepositories(): Promise<LocalRepositories> {
  if (cachedRepositories) {
    return cachedRepositories;
  }

  const database = await openAndInitializeLocalDatabase();
  const settings = new SettingsRepository(database);

  cachedRepositories = {
    settings,
    getHealth: () => settings.getHealth(),
  };

  return cachedRepositories;
}

export function resetLocalRepositoriesForTest(): void {
  cachedRepositories = null;
}
