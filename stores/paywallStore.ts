import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { fetchPaywallConfig } from "../services/paywall-config-service";
import { PaywallConfig } from "../types/paywall";
import {
  DEFAULT_PAYWALL_CONFIG,
  normalizePaywallConfig,
} from "../utils/paywall-config";
import { setFreeDailyLimit } from "../hooks/useNasheedLimit";

const STORAGE_KEY = "@qasid-paywall-config";
const DISMISS_KEY = "@qasid-promo-dismissed";
const CONFIG_TTL_MS = 15 * 60 * 1000;

interface PaywallState {
  config: PaywallConfig;
  loadedAt: number | null;
  /** Promos the user closed on the home banner. Persisted across launches. */
  dismissedPromoIds: string[];
  hydrate: (force?: boolean) => Promise<void>;
  dismissPromo: (id: string) => void;
}

function asIdList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];
}

/**
 * Remote paywall config (promos + free-tier limit). Cached in AsyncStorage so
 * the gate modal already has its copy on a cold start or offline; a failed
 * fetch silently keeps whatever we had, and the shipped defaults reproduce
 * today's hardcoded texts.
 */
export const usePaywallStore = create<PaywallState>((set, get) => ({
  config: DEFAULT_PAYWALL_CONFIG,
  loadedAt: null,
  dismissedPromoIds: [],

  hydrate: async (force = false) => {
    const { loadedAt } = get();
    if (!force && loadedAt !== null && Date.now() - loadedAt < CONFIG_TTL_MS) {
      return;
    }

    const apply = (config: PaywallConfig, loaded: number | null) => {
      setFreeDailyLimit(config.freeDailyLimit);
      set({ config, loadedAt: loaded });
    };

    if (loadedAt === null) {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached) apply(normalizePaywallConfig(JSON.parse(cached)), null);
      } catch {
        // A broken cache must not keep the config from loading from network.
      }

      try {
        const stored = await AsyncStorage.getItem(DISMISS_KEY);
        if (stored) set({ dismissedPromoIds: asIdList(JSON.parse(stored)) });
      } catch {
        // Unreadable dismissals only mean a banner shows once more.
      }
    }

    try {
      const config = await fetchPaywallConfig();
      apply(config, Date.now());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      await pruneDismissed(config);
    } catch {
      // Offline or Firestore unavailable: keep cached/default copy.
    }
  },

  dismissPromo: (id) => {
    const { dismissedPromoIds } = get();
    if (dismissedPromoIds.includes(id)) return;

    const next = [...dismissedPromoIds, id];
    set({ dismissedPromoIds: next });
    void AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(next)).catch(() => {
      // The banner stays closed for this session either way.
    });
  },
}));

/**
 * Drops dismissals for promos that no longer exist, so the list cannot grow
 * without bound over the app's lifetime.
 */
async function pruneDismissed(config: PaywallConfig): Promise<void> {
  const { dismissedPromoIds } = usePaywallStore.getState();
  const live = dismissedPromoIds.filter((id) =>
    config.promos.some((promo) => promo.id === id),
  );
  if (live.length === dismissedPromoIds.length) return;

  usePaywallStore.setState({ dismissedPromoIds: live });
  try {
    await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(live));
  } catch {
    // Pruning is housekeeping; failing it changes nothing the user sees.
  }
}
