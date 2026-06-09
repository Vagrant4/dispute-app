import { BackupRepository } from "../backup/backupRepository";
import { PhotoEvidenceRepository } from "../photos/photoEvidenceRepository";
import { openAndInitializeLocalDatabase } from "./localDatabase";
import { SettingsRepository, type RepositoryHealth } from "./settingsRepository";

export type LocalRepositories = {
  backup: BackupRepository;
  photoEvidence: PhotoEvidenceRepository;
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
  const photoEvidence = new PhotoEvidenceRepository(database);
  const settings = new SettingsRepository(database);

  cachedRepositories = {
    backup,
    photoEvidence,
    settings,
    getHealth: () => settings.getHealth(),
  };

  return cachedRepositories;
}

export function resetLocalRepositoriesForTest(): void {
  cachedRepositories = null;
}
