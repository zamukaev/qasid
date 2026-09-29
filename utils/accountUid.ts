import { getAuth } from "@react-native-firebase/auth";

/**
 * The uid of a signed-in account, or null for guests (anonymous sessions).
 * Use for per-user data (favorites, recents, recommendations); play analytics
 * keep using `currentUser.uid` so guest listening is still counted.
 */
export function accountUid(): string | null {
  const user = getAuth().currentUser;
  return user && !user.isAnonymous ? user.uid : null;
}
