import { getAuthApiBaseUrl } from "../auth/remoteAuth";

export type ReferralSummary = {
  code: string;
  shareUrl: string;
  referredCount: number;
  qualifiedCount: number;
  progressToNextReward: number;
  referralsNeededForNextReward: number;
  earnedRewardMonths: number;
  fulfilledRewardMonths: number;
  rewardMessage: string;
};

type FetchLike = typeof fetch;

export async function fetchReferralSummary(
  fetcher: FetchLike = fetch,
): Promise<{ ok: true; referral: ReferralSummary } | { ok: false; message: string }> {
  try {
    const response = await fetcher(`${getAuthApiBaseUrl()}/referrals/me`, {
      method: "GET",
      credentials: "include",
    });
    const body = await readJsonBody(response);
    if (!response.ok) {
      return { ok: false, message: getMessage(body, "Unable to load referral details.") };
    }
    const referral = parseReferralSummary(body.referral);
    return referral
      ? { ok: true, referral }
      : { ok: false, message: "Referral details are unavailable until the server update completes." };
  } catch {
    return { ok: false, message: "Connect to the internet to load your referral link." };
  }
}

function parseReferralSummary(value: unknown): ReferralSummary | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.code !== "string" ||
    typeof item.shareUrl !== "string" ||
    !item.shareUrl.startsWith("https://") ||
    typeof item.rewardMessage !== "string"
  ) return null;
  for (const key of [
    "referredCount",
    "qualifiedCount",
    "progressToNextReward",
    "referralsNeededForNextReward",
    "earnedRewardMonths",
    "fulfilledRewardMonths",
  ] as const) {
    if (typeof item[key] !== "number" || !Number.isInteger(item[key]) || item[key] < 0) {
      return null;
    }
  }
  return item as ReferralSummary;
}

async function readJsonBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getMessage(body: Record<string, unknown>, fallback: string): string {
  return typeof body.error === "string"
    ? body.error
    : typeof body.message === "string"
      ? body.message
      : fallback;
}
