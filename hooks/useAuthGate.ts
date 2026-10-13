import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { useUserStore } from "../stores/userStore";
import { takePendingShare } from "../utils/pendingShare";

const HOME_ROUTE = "/(tabs)/quran";

/**
 * Route guard. Mounted in the root layout next to `useAuthBootstrap` because
 * the welcome screen is replaced once the user enters the tabs, and a guest
 * signing in from inside the tabs still has to be routed afterwards.
 *
 * - no user                → welcome screen (only when no guest session could
 *                            be started, e.g. offline — see `syncAuthUser`)
 * - guest (anonymous)      → tabs; may open the sign-in/sign-up screens
 * - unverified email user  → verify-email wall
 * - verified user          → tabs
 */
export function useAuthGate(): void {
  const user = useUserStore((s) => s.user);
  const isLoading = useUserStore((s) => s.isLoading);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const [group, screen]: readonly string[] = segments;
    const inTabs = group === "(tabs)";
    const inAuth = group === "(auth)";
    const inVerifyEmail = inAuth && screen === "verify-email";
    // The share landing route resolves the link itself and replaces itself
    // with the destination, so this gate must not redirect out from under it.
    const inShareTarget = group === "t";

    const goHome = () => {
      if (router.canDismiss()) router.dismissAll();
      // A link that arrived before the user could follow it was stashed;
      // now that they are through, send them where they were headed.
      router.replace(takePendingShare() ?? HOME_ROUTE);
    };

    if (!user) {
      if (inTabs || inVerifyEmail) router.replace("/");
      return;
    }

    if (user.isAnonymous) {
      if (!inTabs && !inShareTarget && (!inAuth || inVerifyEmail)) goHome();
      return;
    }

    if (!user.emailVerified) {
      if (!inVerifyEmail) router.replace("/verify-email");
      return;
    }

    if (!inTabs && !inShareTarget) goHome();
  }, [user, isLoading]);
}
