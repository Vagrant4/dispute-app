import { useEffect, useState } from "react";

import type { LocalAccount } from "../auth/localAuth";
import { fetchDisputeBasicStorePrice } from "./subscriptionClient";

const STORE_PRICE_FALLBACK = "S$6.99 a month (final price shown in Google Play)";

export function useDisputeBasicStorePrice(account: LocalAccount): string | null {
  const [localizedPrice, setLocalizedPrice] = useState<string | null>(null);

  useEffect(() => {
    void fetchDisputeBasicStorePrice(account).then((result) => {
      setLocalizedPrice(result.ok ? result.localizedPrice : null);
    });
  }, [account]);

  return localizedPrice;
}

export function formatMonthlyStorePrice(localizedPrice: string | null): string {
  return localizedPrice ? `${localizedPrice} a month` : STORE_PRICE_FALLBACK;
}
