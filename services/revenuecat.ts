import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import { useUserStore } from "../stores/userStore";

const ENTITLEMENT_ID = "qasid Premium";
let listenerRegistered = false;

function syncPlanFromCustomerInfo(info: CustomerInfo): void {
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  const setCurrentPlan = useUserStore.getState().setCurrentPlan;

  if (!entitlement) {
    setCurrentPlan("free");
    return;
  }

  const productId = entitlement.productIdentifier;
  if (productId === "com.abusafiia.qasid.premium.yearly") {
    setCurrentPlan("yearly");
  } else {
    setCurrentPlan("monthly");
  }
}

export async function initialize(userId: string): Promise<void> {
  await Purchases.logIn(userId);

  if (!listenerRegistered) {
    Purchases.addCustomerInfoUpdateListener(syncPlanFromCustomerInfo);
    listenerRegistered = true;
  }

  const info = await Purchases.getCustomerInfo();
  syncPlanFromCustomerInfo(info);
}

export async function logout(): Promise<void> {
  try {
    const isAnonymous = await Purchases.isAnonymous();
    if (!isAnonymous) {
      await Purchases.logOut();
    }
  } catch {
    // ignore unexpected errors
  }
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  syncPlanFromCustomerInfo(customerInfo);
  return customerInfo;
}

export async function checkPremiumAccess(): Promise<boolean> {
  const info = await Purchases.getCustomerInfo();
  syncPlanFromCustomerInfo(info);
  return !!info.entitlements.active[ENTITLEMENT_ID];
}

export async function restorePurchases(): Promise<CustomerInfo> {
  const info = await Purchases.restorePurchases();
  syncPlanFromCustomerInfo(info);
  return info;
}
