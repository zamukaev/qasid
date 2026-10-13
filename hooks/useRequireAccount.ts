import { useCallback } from "react";
import { useIsGuest } from "../stores/userStore";
import { useSignInGateStore } from "../stores/signInGateStore";

/**
 * `requireAccount("save favorites")` returns true for signed-in users; for
 * guests it opens the sign-in gate and returns false, so call sites read:
 * `if (!requireAccount("…")) return;`
 */
export function useRequireAccount() {
  const isGuest = useIsGuest();
  const openGate = useSignInGateStore((s) => s.open);

  const requireAccount = useCallback(
    (feature: string): boolean => {
      if (!isGuest) return true;
      openGate(feature);
      return false;
    },
    [isGuest, openGate],
  );

  return { isGuest, requireAccount };
}
