import { BackupRepository } from "../backup/backupRepository";
import { openAndInitializeLocalDatabase } from "./localDatabase";
import { SettingsRepository, type RepositoryHealth } from "./settingsRepository";

export type LocalRepositories = {
  backup: BackupRepository;
  settings: SettingsRepository;
  getHealth: () => Promise<RepositoryHealth>;
};

let cachedRepositories: LocalRepositories | null = null;

export async function getLocalRepositories(): Promise<LocalRepositories> {
  if (cachedRepositories) {
    return cachedRepositories;
  }

  const database = await openAndInitializeLocalDatabase();
  const backup = new BackupRepository(database);
  const settings = new SettingsRepository(database);

  cachedRepositories = {
    backup,
    settings,
    getHealth: () => settings.getHealth(),
  };

  return cachedRepositories;
}

export function resetLocalRepositoriesForTest(): void {
  cachedRepositories = null;
}
