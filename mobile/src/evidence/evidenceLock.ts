export type EvidenceRecord = Record<string, unknown>;

export type EvidenceLock = {
  canonicalJson: string;
  hash: string;
  lockedAt: string;
};

export type EvidenceHashProvider = (canonicalJson: string) => Promise<string> | string;

export type EvidenceLockOptions = {
  hashProviders?: readonly EvidenceHashProvider[];
};

type ExpoCryptoModule = {
  CryptoDigestAlgorithm?: {
    SHA256?: string;
  };
  digestStringAsync?: (algorithm: string, data: string) => Promise<string>;
};

type NodeCryptoModule = {
  createHash?: (algorithm: string) => {
    update: (data: string) => {
      digest: (encoding: "hex") => string;
    };
  };
};

declare const require:
  | ((moduleName: string) => unknown)
  | undefined;

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value));
}

export async function createEvidenceLock(
  record: EvidenceRecord,
  lockedAt = new Date().toISOString(),
  options: EvidenceLockOptions = {},
): Promise<EvidenceLock> {
  const canonicalJson = canonicalStringify(record);

  return {
    canonicalJson,
    hash: await hashWithProviders(
      canonicalJson,
      options.hashProviders ?? getRuntimeHashProviders(),
    ),
    lockedAt,
  };
}

export async function verifyEvidenceLock(
  record: EvidenceRecord,
  expectedHash: string,
  options: EvidenceLockOptions = {},
): Promise<boolean> {
  const lock = await createEvidenceLock(record, new Date().toISOString(), options);
  return lock.hash === expectedHash;
}

export async function hashWithProviders(
  canonicalJson: string,
  hashProviders: readonly EvidenceHashProvider[],
): Promise<string> {
  if (hashProviders.length === 0) {
    throw new Error("SHA-256 hashing failed for all configured providers.");
  }

  for (const hashProvider of hashProviders) {
    try {
      const hash = await hashProvider(canonicalJson);
      if (typeof hash === "string" && hash.length > 0) {
        return hash;
      }
    } catch {
      // Try the next provider so mobile can fall back across available runtimes.
    }
  }

  throw new Error("SHA-256 hashing failed for all configured providers.");
}

function toCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined || typeof item === "function" ? null : toCanonicalValue(item),
    );
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const canonical: Record<string, unknown> = {};

  for (const key of Object.keys(record).sort()) {
    const nextValue = record[key];
    if (nextValue !== undefined && typeof nextValue !== "function") {
      canonical[key] = toCanonicalValue(nextValue);
    }
  }

  return canonical;
}

function getRuntimeHashProviders(): readonly EvidenceHashProvider[] {
  return [sha256WithWebCrypto, sha256WithExpoCrypto, sha256WithNodeCrypto];
}

async function sha256WithWebCrypto(data: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto SHA-256 is not available.");
  }

  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(data));
  return bytesToHex(new Uint8Array(digest));
}

async function sha256WithExpoCrypto(data: string): Promise<string> {
  if (typeof require !== "function") {
    throw new Error("Expo Crypto SHA-256 is not available.");
  }

  const expoCrypto = require("expo-crypto") as ExpoCryptoModule;
  const algorithm = expoCrypto.CryptoDigestAlgorithm?.SHA256 ?? "SHA-256";
  const hash = await expoCrypto.digestStringAsync?.(algorithm, data);

  if (!hash) {
    throw new Error("Expo Crypto SHA-256 is not available.");
  }

  return hash;
}

function sha256WithNodeCrypto(data: string): string {
  if (typeof require !== "function") {
    throw new Error("Node Crypto SHA-256 is not available.");
  }

  const nodeCrypto = require("node:crypto") as NodeCryptoModule;
  const hash = nodeCrypto.createHash?.("sha256").update(data).digest("hex");

  if (!hash) {
    throw new Error("Node Crypto SHA-256 is not available.");
  }

  return hash;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
