import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUserStore } from "../stores/userStore";

const STORAGE_KEY = "@qasid-guest-nudge";

/** Qualified listens (see QUALIFIED_LISTEN_MS) as a guest before the first
 *  "create an account" nudge — enough to show real interest. */
const LISTEN_THRESHOLD = 3;
/** After this many nudges only the feature gates ask for an account. */
const MAX_NUDGES = 3;
const NUDGE_COOLDOWN_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type GuestNudgeState = {
  guestListens: number;
  shownCount: number;
  lastShownAt: number | null;
};

const INITIAL_STATE: GuestNudgeState = {
  guestListens: 0,
  shownCount: 0,
  lastShownAt: null,
};

// Module-level singleton, same pattern as services/review-service.ts. Kept
// separate from the review counter on purpose: that one also holds listens
// from before a logout, which would fire the nudge the moment a user becomes
// a guest.
let _state: GuestNudgeState = { ...INITIAL_STATE };
let _hydrated = false;
/** Track ids already counted, so the per-tick call below is idempotent. */
const _countedTrackIds = new Set<string>();

function isGuest(): boolean {
  return useUserStore.getState().user?.isAnonymous === true;
}

function persist(): void {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_state)).catch(
    () => {},
  );
}

/** Loads the persisted state. Idempotent — safe to call on every cold start. */
export async function initGuestNudge(): Promise<void> {
  if (_hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) _state = { ..._state, ...(JSON.parse(raw) as GuestNudgeState) };
  } catch {}
  _hydrated = true;
}

/** Called once a track has been played for QUALIFIED_LISTEN_MS. Counts only
 *  guest listens; repeat calls for the same track are ignored. */
export function noteGuestListen(trackId: string): void {
  if (!_hydrated || !isGuest()) return;
  if (_countedTrackIds.has(trackId)) return;
  _countedTrackIds.add(trackId);
  _state.guestListens++;
  persist();
}

export function isEligibleForGuestNudge(): boolean {
  if (!_hydrated || !isGuest()) return false;
  if (_state.guestListens < LISTEN_THRESHOLD) return false;
  if (_state.shownCount >= MAX_NUDGES) return false;
  return (
    _state.lastShownAt === null ||
    Date.now() - _state.lastShownAt >= NUDGE_COOLDOWN_DAYS * MS_PER_DAY
  );
}

export function markGuestNudgeShown(): void {
  _state.shownCount++;
  _state.lastShownAt = Date.now();
  persist();
}

/** Testing helper — wipes all nudge state so it can fire again. */
export async function resetGuestNudgeState(): Promise<void> {
  _state = { ...INITIAL_STATE };
  _countedTrackIds.clear();
  _hydrated = false;
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  await initGuestNudge();
}
