export function projectAddressLabel(address?: string | null): string {
  return `Address: ${address?.trim() || "None"}`;
}
