const listeners = new Set<() => void>();

export function subscribeToEntitlementRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function requestEntitlementRefresh(): void {
  listeners.forEach((listener) => listener());
}
