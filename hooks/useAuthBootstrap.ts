import { useEffect } from "react";
import {
  FirebaseAuthTypes,
  getAuth,
  onAuthStateChanged,
} from "@react-native-firebase/auth";

import * as RevenueCatService from "../services/revenuecat";
import { fetchPremiumOverrideEmails } from "../services/config-service";
import { hydrateAndSyncSubscription } from "../services/notifications-service";
import { setAnalyticsPlan, setAnalyticsUser } from "../services/analytics";
import { useFavoritesStore } from "../stores/favoritesStore";
import { usePaywallStore } from "../stores/paywallStore";
import { useUserStore } from "../stores/userStore";

/**
 * Subscribes to Firebase auth and hydrates everything that hangs off a signed-in
 * user (RevenueCat, paywall config, push subscription, favorites, analytics).
 *
 * Mounted by the root layout, not by a screen. It used to live in
 * `app/index.tsx`, which meant it only ran when `/` happened to be on screen —
 * a cold start straight into a deep link never mounts that route, so
 * `isLoading` stayed true forever and the target screen waited on auth that
 * was never resolved.
 */
export function useAuthBootstrap(): void {
  useEffect(() => {
    const { setUser, setLoading, setPremiumOverrideEmails } =
      useUserStore.getState();

    const handleAuthStateChanged = async (
      firebaseUser: FirebaseAuthTypes.User | null,
    ) => {
      setUser(firebaseUser);
      void setAnalyticsUser(firebaseUser?.uid ?? null);

      if (!firebaseUser) {
        useFavoritesStore.getState().clear();
        await RevenueCatService.logout();
        return;
      }

      try {
        await RevenueCatService.initialize(firebaseUser.uid);
      } catch {
        // RC initialization failure should not block the auth flow
      }
      try {
        setPremiumOverrideEmails(await fetchPremiumOverrideEmails());
      } catch {
        // config fetch failure is non-fatal
      }
      try {
        await usePaywallStore.getState().hydrate();
      } catch {
        // paywall config fetch failure is non-fatal — defaults apply
      }
      try {
        await hydrateAndSyncSubscription();
      } catch {
        // notification subscription failure should not block the auth flow
      }
      // Prefetched here so the first list a user opens already knows which
      // nasheeds are favorited; failure is non-fatal and retried by the tab.
      void useFavoritesStore
        .getState()
        .hydrate(true)
        .catch(() => {});
    };

    setLoading(true);
    return onAuthStateChanged(getAuth(), handleAuthStateChanged);
  }, []);

  // RevenueCat resolves the entitlement asynchronously, so the plan is mirrored
  // to Analytics whenever it changes rather than once at sign-in.
  useEffect(() => {
    void setAnalyticsPlan(useUserStore.getState().currentPlan);
    return useUserStore.subscribe((state, previous) => {
      if (state.currentPlan !== previous.currentPlan) {
        void setAnalyticsPlan(state.currentPlan);
      }
    });
  }, []);
}
