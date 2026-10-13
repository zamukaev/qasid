import {
  FirebaseAuthTypes,
  getAuth,
  linkWithCredential,
  signInAnonymously,
  signInWithCredential,
} from "@react-native-firebase/auth";
import { useUserStore } from "../stores/userStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import { useUserPlaylistsStore } from "../stores/userPlaylistsStore";
import * as RevenueCatService from "./revenuecat";
import { fetchPremiumOverrideEmails } from "./config-service";
import { hydrateAndSyncSubscription } from "./notifications-service";
import { setAnalyticsUser } from "./analytics";
import { usePaywallStore } from "../stores/paywallStore";

// Linking a guest to a credential that already belongs to another account
// fails with one of these; the user then simply signs into that account.
const ACCOUNT_EXISTS_CODES = new Set([
  "auth/credential-already-in-use",
  "auth/email-already-in-use",
  "auth/provider-already-linked",
]);

/**
 * Mirrors a Firebase user into the app: store, analytics, RevenueCat, paywall
 * config, push subscription, favorites and playlists. Called by
 * `useAuthBootstrap` on every auth state change and by `signInOrLink` after a
 * guest is upgraded — linking keeps the uid, so `onAuthStateChanged` does not
 * fire for it.
 */
export async function syncAuthUser(
  firebaseUser: FirebaseAuthTypes.User | null,
): Promise<void> {
  const { setUser, setPremiumOverrideEmails } = useUserStore.getState();

  if (!firebaseUser) {
    await startGuestSession();
    return;
  }
  setUser(firebaseUser);
  void setAnalyticsUser(firebaseUser.uid);

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

  // Dropped on every account change, so one user's playlists can never be
  // shown, or written to, under the next user's session.
  useUserPlaylistsStore.getState().clear();
  if (firebaseUser.isAnonymous) {
    useFavoritesStore.getState().clear();
    return;
  }
  // Prefetched here so the first list a user opens already knows which
  // nasheeds are favorited; failure is non-fatal and retried by the tab.
  void useFavoritesStore
    .getState()
    .hydrate(true)
    .catch(() => {});
  void useUserPlaylistsStore
    .getState()
    .hydrate()
    .catch(() => {});
}

export async function continueAsGuest(): Promise<void> {
  await signInAnonymously(getAuth());
}

/**
 * With no session (first launch, logout, account deletion) the app drops
 * straight into guest mode. The loading state is held until the anonymous
 * user arrives via `onAuthStateChanged`, so no welcome screen flashes. Only
 * if that fails (offline, provider disabled) is the welcome screen shown as
 * a fallback, with sign-in options and a retry.
 */
async function startGuestSession(): Promise<void> {
  const { clearUser, setLoading } = useUserStore.getState();
  clearUser();
  setLoading(true);
  void setAnalyticsUser(null);
  useFavoritesStore.getState().clear();
  useUserPlaylistsStore.getState().clear();
  await RevenueCatService.logout();
  try {
    await continueAsGuest();
  } catch {
    setLoading(false);
  }
}

function isAccountExistsError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" && ACCOUNT_EXISTS_CODES.has(code);
}

/**
 * Creates an account from `credential`, upgrading the current guest session
 * in place when there is one so the uid (and RevenueCat identity) is kept.
 * If the credential already belongs to an existing account we fall back to
 * signing into it — guests hold no account-bound data, so nothing is lost.
 * Some providers (Apple) reject a reused token; the original "already in
 * use" error is surfaced then so the user can sign in instead.
 */
export async function signInOrLink(
  credential: FirebaseAuthTypes.AuthCredential,
): Promise<FirebaseAuthTypes.UserCredential> {
  const auth = getAuth();
  const current = auth.currentUser;

  if (!current?.isAnonymous) {
    return signInWithCredential(auth, credential);
  }

  try {
    const result = await linkWithCredential(current, credential);
    await syncAuthUser(result.user);
    return result;
  } catch (linkError) {
    if (!isAccountExistsError(linkError)) throw linkError;
    try {
      return await signInWithCredential(auth, credential);
    } catch {
      throw linkError;
    }
  }
}
