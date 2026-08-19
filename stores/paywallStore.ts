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
const CONFIG_TTL_MS = 15 * 60 * 1000;

interface PaywallState {
  config: PaywallConfig;
  loadedAt: number | null;
  hydrate: (force?: boolean) => Promise<void>;
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
    }

    try {
      const config = await fetchPaywallConfig();
      apply(config, Date.now());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Offline or Firestore unavailable: keep cached/default copy.
    }
  },
}));
