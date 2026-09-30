import { create } from "zustand";

interface SignInGateState {
  /** What the guest tried to do, e.g. "save favorites"; null when closed. */
  feature: string | null;
  open: (feature: string) => void;
  close: () => void;
}

// One gate for the whole app — rendered once by <SignInGateModal /> in the
// root layout so list rows (e.g. every FavoriteButton) don't each mount a Modal.
export const useSignInGateStore = create<SignInGateState>((set) => ({
  feature: null,
  open: (feature) => set({ feature }),
  close: () => set({ feature: null }),
}));
