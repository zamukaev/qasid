import { getApp } from "@react-native-firebase/app";
import { doc, getDoc, getFirestore } from "@react-native-firebase/firestore";
import { PaywallConfig } from "../types/paywall";
import { normalizePaywallConfig } from "../utils/paywall-config";

const CONFIG_COLLECTION = "config";
const PAYWALL_DOC_ID = "paywall";

/**
 * Reads the remotely authored paywall config. Sits next to
 * `config/premiumAccounts` (see `services/config-service.ts`) and is covered by
 * the same public-read / no-write Firestore rule, so promos are edited in the
 * Firebase console — no app release needed.
 */
export async function fetchPaywallConfig(): Promise<PaywallConfig> {
  const db = getFirestore(getApp());
  const snapshot = await getDoc(doc(db, CONFIG_COLLECTION, PAYWALL_DOC_ID));
  return normalizePaywallConfig(snapshot.data());
}
