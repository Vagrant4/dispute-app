import { BackupRepository } from "../backup/backupRepository";
import { PhotoEvidenceRepository } from "../photos/photoEvidenceRepository";
import { GeneratedDocumentRepository } from "../reports/generatedDocumentRepository";
import { ProgressClaimSourceRepository } from "../reports/progressClaimSourceRepository";
import { openAndInitializeLocalDatabase } from "./localDatabase";
import { SettingsRepository, type RepositoryHealth } from "./settingsRepository";

export type LocalRepositories = {
  backup: BackupRepository;
  generatedDocuments: GeneratedDocumentRepository;
  photoEvidence: PhotoEvidenceRepository;
  progressClaims: ProgressClaimSourceRepository;
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
  const generatedDocuments = new GeneratedDocumentRepository(database);
  const photoEvidence = new PhotoEvidenceRepository(database);
  const progressClaims = new ProgressClaimSourceRepository(database);
  const settings = new SettingsRepository(database);

  cachedRepositories = {
    backup,
    generatedDocuments,
    photoEvidence,
    progressClaims,
    settings,
    getHealth: () => settings.getHealth(),
  };

  return cachedRepositories;
}

export function resetLocalRepositoriesForTest(): void {
  cachedRepositories = null;
}
