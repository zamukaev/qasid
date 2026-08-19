import { useEffect, useState } from "react";
import * as RevenueCatService from "../services/revenuecat";
import { OfferingSummary } from "../types/paywall";
import { summarizeOffering } from "../utils/store-offer";

/**
 * Offerings for display only, fetched at most once per session.
 *
 * The gate modal is mounted on three different screens, so it must not run a
 * full `useRevenueCat()` fetch on every mount. Purchases still go through
 * `useRevenueCat` on the premium screen.
 */
let cachedSummary: OfferingSummary | null = null;
let inflight: Promise<OfferingSummary | null> | null = null;

function loadSummary(): Promise<OfferingSummary | null> {
  if (cachedSummary) return Promise.resolve(cachedSummary);

  if (!inflight) {
    inflight = RevenueCatService.getOfferings()
      .then((offering) => {
        // No offering means the store returned nothing — leave the cache empty
        // so a later mount retries instead of caching a priceless summary.
        if (!offering) return null;
        cachedSummary = summarizeOffering(offering);
        return cachedSummary;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export function useOfferingsSummary(enabled = true): OfferingSummary | null {
  const [summary, setSummary] = useState<OfferingSummary | null>(cachedSummary);

  useEffect(() => {
    if (!enabled || summary) return;

    let active = true;
    void loadSummary().then((loaded) => {
      if (active && loaded) setSummary(loaded);
    });

    return () => {
      active = false;
    };
  }, [enabled, summary]);

  return enabled ? summary : null;
}
