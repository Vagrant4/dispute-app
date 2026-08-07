import { BackupRepository } from "../backup/backupRepository";
import { PhotoEvidenceRepository } from "../photos/photoEvidenceRepository";
import { GeneratedDocumentRepository } from "../reports/generatedDocumentRepository";
import { ProgressClaimSourceRepository } from "../reports/progressClaimSourceRepository";
import {
  openAndInitializeLocalDatabase,
  type LocalDatabase,
} from "./localDatabase";
import {
  claimLegacyLocalDataForUser,
  hasLegacyLocalData,
} from "./localDataOwnership";
import { SettingsRepository, type RepositoryHealth } from "./settingsRepository";
import { WorkRepository } from "../work/workRepository";

export type LocalRepositories = {
  backup: BackupRepository;
  generatedDocuments: GeneratedDocumentRepository;
  photoEvidence: PhotoEvidenceRepository;
  progressClaims: ProgressClaimSourceRepository;
  settings: SettingsRepository;
  work: WorkRepository;
  getHealth: () => Promise<RepositoryHealth>;
};

let cachedRepositories: LocalRepositories | null = null;
let cachedDatabase: LocalDatabase | null = null;
const ownershipClaims = new Map<string, Promise<void>>();

export async function getLocalRepositories(userId?: string): Promise<LocalRepositories> {
  if (!cachedRepositories || !cachedDatabase) {
    const database = await openAndInitializeLocalDatabase();
    const backup = new BackupRepository(database);
    const generatedDocuments = new GeneratedDocumentRepository(database);
    const photoEvidence = new PhotoEvidenceRepository(database);
    const progressClaims = new ProgressClaimSourceRepository(database);
    const settings = new SettingsRepository(database);
    const work = new WorkRepository(database);

    cachedDatabase = database;
    cachedRepositories = {
      backup,
      generatedDocuments,
      photoEvidence,
      progressClaims,
      settings,
      work,
      getHealth: () => settings.getHealth(),
    };
  }

  if (userId) {
    let claim = ownershipClaims.get(userId);
    if (!claim) {
      claim = canClaimPersistedLegacyData(userId).then(async (approved) => {
        if (approved) {
          await claimLegacyLocalDataForUser(cachedDatabase!, userId);
        }
      });
      ownershipClaims.set(userId, claim);
    }
    await claim;
  }

  return cachedRepositories;
}

async function canClaimPersistedLegacyData(userId: string): Promise<boolean> {
  const { phoneLocalAccountStorage } = await import(
    "../auth/localAuthStorageExpo"
  );
  const accounts = await phoneLocalAccountStorage.loadAccounts();
  if (accounts.length !== 1) {
    return false;
  }
  const persistedUserId =
    accounts[0]?.id ?? accounts[0]?.email.trim().toLowerCase();
  return persistedUserId === userId;
}

export function resetLocalRepositoriesForTest(): void {
  cachedRepositories = null;
  cachedDatabase = null;
  ownershipClaims.clear();
}

export async function hasLegacyLocalRepositories(): Promise<boolean> {
  await getLocalRepositories();
  return hasLegacyLocalData(cachedDatabase!);
}

export async function claimLegacyLocalRepositoriesForUser(
  userId: string,
): Promise<boolean> {
  await getLocalRepositories();
  const claimed = await claimLegacyLocalDataForUser(cachedDatabase!, userId);
  ownershipClaims.set(userId, Promise.resolve());
  return claimed;
}
