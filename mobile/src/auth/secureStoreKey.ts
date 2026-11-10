export function sanitizeSecureStoreKeyPart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}
