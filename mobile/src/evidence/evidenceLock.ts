export type EvidenceRecord = Record<string, unknown>;

export type EvidenceLock = {
  canonicalJson: string;
  hash: string;
  lockedAt: string;
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
): Promise<EvidenceLock> {
  const canonicalJson = canonicalStringify(record);

  return {
    canonicalJson,
    hash: await sha256Hex(canonicalJson),
    lockedAt,
  };
}

export async function verifyEvidenceLock(
  record: EvidenceRecord,
  expectedHash: string,
): Promise<boolean> {
  const lock = await createEvidenceLock(record);
  return lock.hash === expectedHash;
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

async function sha256Hex(data: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(data));
    return bytesToHex(new Uint8Array(digest));
  }

  const expoHash = await sha256WithExpoCrypto(data);
  if (expoHash) {
    return expoHash;
  }

  const nodeHash = sha256WithNodeCrypto(data);
  if (nodeHash) {
    return nodeHash;
  }

  throw new Error("SHA-256 hashing is not available in this runtime.");
}

async function sha256WithExpoCrypto(data: string): Promise<string | null> {
  if (typeof require !== "function") {
    return null;
  }

  try {
    const expoCrypto = require("expo-crypto") as ExpoCryptoModule;
    const algorithm = expoCrypto.CryptoDigestAlgorithm?.SHA256 ?? "SHA-256";
    return (await expoCrypto.digestStringAsync?.(algorithm, data)) ?? null;
  } catch {
    return null;
  }
}

function sha256WithNodeCrypto(data: string): string | null {
  if (typeof require !== "function") {
    return null;
  }

  try {
    const nodeCrypto = require("node:crypto") as NodeCryptoModule;
    return nodeCrypto.createHash?.("sha256").update(data).digest("hex") ?? null;
  } catch {
    return null;
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
