import { useCallback, useEffect, useRef, useState } from "react";
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import * as RevenueCatService from "../services/revenuecat";

const ENTITLEMENT_ID = "qasid Premium";
const OFFERINGS_ERROR_FALLBACK =
  "Subscription options could not be loaded. Please try again.";

function readStringProp(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null) return null;
  const prop = (value as Record<string, unknown>)[key];
  return typeof prop === "string" && prop.length > 0 ? prop : null;
}

// RevenueCat rejects with an object carrying a user-facing `message` plus an
// `underlyingErrorMessage` naming the actual store problem (products missing
// from App Store Connect, Paid Apps agreement not active, …). Both are worth
// surfacing — the underlying one is what makes a misconfiguration diagnosable.
function describeOfferingsError(error: unknown): string {
  const parts = [
    readStringProp(error, "message"),
    readStringProp(error, "underlyingErrorMessage"),
  ].filter((part): part is string => part !== null);

  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join(" ") : OFFERINGS_ERROR_FALLBACK;
}

export function useRevenueCat() {
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const listener = (info: CustomerInfo) => {
      if (!mountedRef.current) return;
      setCustomerInfo(info);
      setIsPremium(!!info.entitlements.active[ENTITLEMENT_ID]);
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      mountedRef.current = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    Promise.all([
      RevenueCatService.getOfferings(),
      Purchases.getCustomerInfo(),
    ])
      .then(([offering, info]) => {
        if (!mountedRef.current) return;
        setOfferings(offering);
        setCustomerInfo(info);
        setIsPremium(!!info.entitlements.active[ENTITLEMENT_ID]);
      })
      .catch((cause: unknown) => {
        if (!mountedRef.current) return;
        setOfferings(null);
        setError(describeOfferingsError(cause));
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });
  }, [reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage): Promise<CustomerInfo> => {
      const info = await RevenueCatService.purchasePackage(pkg);
      if (mountedRef.current) {
        setCustomerInfo(info);
        setIsPremium(!!info.entitlements.active[ENTITLEMENT_ID]);
      }
      return info;
    },
    []
  );

  const restorePurchases = useCallback(async (): Promise<CustomerInfo> => {
    const info = await RevenueCatService.restorePurchases();
    if (mountedRef.current) {
      setCustomerInfo(info);
      setIsPremium(!!info.entitlements.active[ENTITLEMENT_ID]);
    }
    return info;
  }, []);

  return {
    offerings,
    customerInfo,
    isPremium,
    isLoading,
    error,
    reload,
    purchasePackage,
    restorePurchases,
  };
}
