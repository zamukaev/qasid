import { create } from "zustand";

/** "feature": a guest tapped an account-only feature. "nudge": the periodic
 *  invitation after a few listens (services/guest-nudge-service.ts). */
export type SignInGateReason = "feature" | "nudge";

interface SignInGateState {
  visible: boolean;
  reason: SignInGateReason;
  /** What the guest tried to do, e.g. "save favorites"; null for a nudge. */
  feature: string | null;
  open: (feature: string) => void;
  nudge: () => void;
  close: () => void;
}

// One gate for the whole app — rendered once by <SignInGateModal /> in the
// root layout so list rows (e.g. every FavoriteButton) don't each mount a Modal.
export const useSignInGateStore = create<SignInGateState>((set) => ({
  visible: false,
  reason: "feature",
  feature: null,
  open: (feature) => set({ visible: true, reason: "feature", feature }),
  nudge: () => set({ visible: true, reason: "nudge", feature: null }),
  close: () => set({ visible: false }),
}));
