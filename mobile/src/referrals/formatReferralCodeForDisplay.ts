export function formatReferralCodeForDisplay(code: string): string {
  const compact = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return [compact.slice(0, 3), ...(compact.slice(3).match(/.{1,4}/g) ?? [])].filter(Boolean).join(" ");
}
