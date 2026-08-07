import { useEffect, useState } from "react";

import type { LocalAccount } from "../auth/localAuth";
import { fetchDisputeBasicStorePrice } from "./subscriptionClient";

const STORE_PRICE_FALLBACK = "S$6.99/month - final price shown in store";

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
  return localizedPrice ? `${localizedPrice}/month` : STORE_PRICE_FALLBACK;
}
