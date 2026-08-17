// TEMP admin curation hotfix — remove with MoodPickerModal.
import { ADMIN_UIDS } from "../constants/admin";
import { useUserStore } from "../stores/userStore";

/** Mirrors the `useIsPremium` selector style in stores/userStore.ts. */
export const useIsAdmin = () =>
  useUserStore((s) => !!s.user && ADMIN_UIDS.includes(s.user.uid));
