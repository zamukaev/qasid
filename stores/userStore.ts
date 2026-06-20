import { create } from "zustand";
import { FirebaseAuthTypes } from "@react-native-firebase/auth";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export type SubscriptionPlan = "free" | "monthly" | "yearly" | "family";

interface UserState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  currentPlan: SubscriptionPlan;
  /**
   * False until RevenueCat has reported the real entitlement. `currentPlan`
   * defaults to "free", so consumers that enforce free-tier restrictions
   * (e.g. stopping background audio) must wait for this to be true before
   * treating a user as free — otherwise a premium user is briefly mistreated
   * during RC init / after a cold start.
   */
  planResolved: boolean;
  setUser: (firebaseUser: FirebaseAuthTypes.User | null) => void;
  updateUser: (updates: Partial<User>) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  setCurrentPlan: (plan: SubscriptionPlan) => void;
}

const mapFirebaseUser = (
  firebaseUser: FirebaseAuthTypes.User | null
): User | null => {
  if (!firebaseUser) return null;

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
  };
};

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  currentPlan: "free",
  planResolved: false,

  setUser: (firebaseUser) => {
    const user = mapFirebaseUser(firebaseUser);
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    });
  },

  updateUser: (updates) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    }));
  },

  clearUser: () => {
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      planResolved: false,
    });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setCurrentPlan: (plan) => {
    // Only RevenueCat sync paths call this, so reaching here means the real
    // entitlement is now known.
    set({ currentPlan: plan, planResolved: true });
  },
}));

// This email is treated as a premium user regardless of its subscription plan.
export const PREMIUM_OVERRIDE_EMAIL = "abu.safiia2016@gmail.com";

// Effective premium status: a real subscription OR the override email.
export const useIsPremium = () =>
  useUserStore(
    (s) => s.currentPlan !== "free" || s.user?.email === PREMIUM_OVERRIDE_EMAIL,
  );
