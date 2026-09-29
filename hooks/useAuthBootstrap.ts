import { useEffect } from "react";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";

import { syncAuthUser } from "../services/auth-service";
import { setAnalyticsPlan } from "../services/analytics";
import { useUserStore } from "../stores/userStore";

/**
 * Subscribes to Firebase auth and hydrates everything that hangs off the user
 * (RevenueCat, paywall config, push subscription, favorites, analytics) via
 * `syncAuthUser`. Routing is separate: `hooks/useAuthGate.ts`.
 *
 * Mounted by the root layout, not by a screen. It used to live in
 * `app/index.tsx`, which meant it only ran when `/` happened to be on screen —
 * a cold start straight into a deep link never mounts that route, so
 * `isLoading` stayed true forever and the target screen waited on auth that
 * was never resolved.
 */
export function useAuthBootstrap(): void {
  useEffect(() => {
    useUserStore.getState().setLoading(true);
    // Signed out → a guest session is started; see `syncAuthUser`.
    return onAuthStateChanged(getAuth(), (firebaseUser) => {
      void syncAuthUser(firebaseUser);
    });
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
