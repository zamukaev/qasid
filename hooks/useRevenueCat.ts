import { useCallback, useEffect, useRef, useState } from "react";
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import * as RevenueCatService from "../services/revenuecat";

const ENTITLEMENT_ID = "qasid Premium";

export function useRevenueCat() {
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const listener = (info: CustomerInfo) => {
      if (!mountedRef.current) return;
      setCustomerInfo(info);
      setIsPremium(!!info.entitlements.active[ENTITLEMENT_ID]);
    };

    Purchases.addCustomerInfoUpdateListener(listener);

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
      .catch(() => {})
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });

    return () => {
      mountedRef.current = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
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
    purchasePackage,
    restorePurchases,
  };
}
