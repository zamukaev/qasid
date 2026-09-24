import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as StoreReview from "expo-store-review";
import { AppState } from "react-native";

const STORAGE_KEY = "@qasid-review-prompt";

/** A track must actually play this long before it counts as a listen — a tap
 *  that gets skipped after two seconds is not engagement. Mirrors the
 *  "qualified" playback-analytics threshold used by the reciter screen. */
export const QUALIFIED_LISTEN_MS = 30_000;
/** Listens (nasheeds + quran combined) that make a user eligible. */
const LISTEN_THRESHOLD = 5;
/** Alternative path: the app has been installed at least this long … */
const USAGE_AGE_DAYS = 7;
/** … and was actually opened on at least this many distinct days. */
const MIN_SESSION_DAYS = 3;
/** iOS silently caps the sheet at 3 shows per 365 days; don't spend more. */
const MAX_PROMPTS = 3;
const PROMPT_COOLDOWN_DAYS = 120;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ReviewState = {
  firstLaunchAt: number;
  /** Distinct "YYYY-MM-DD" app-open days, capped at MIN_SESSION_DAYS. */
  sessionDays: string[];
  qualifiedListens: number;
  lastPromptedAt: number | null;
  promptCount: number;
  lastPromptedVersion: string | null;
};

// Module-level singleton so the audio context and the tabs layout share one
// state without prop drilling — same pattern as hooks/useNasheedLimit.ts.
let _state: ReviewState = {
  firstLaunchAt: 0,
  sessionDays: [],
  qualifiedListens: 0,
  lastPromptedAt: null,
  promptCount: 0,
  lastPromptedVersion: null,
};
let _hydrated = false;
let _promptInFlight = false;
/** Track ids already counted, so the per-tick call below is idempotent. */
const _countedTrackIds = new Set<string>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentVersion(): string | null {
  return Constants.expoConfig?.version ?? null;
}

function persist(): void {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_state)).catch(
    () => {},
  );
}

/** Records first launch and the current session day. Idempotent — safe to call
 *  on every cold start. Runs before auth: review state is device-scoped. */
export async function initReviewTracking(): Promise<void> {
  if (!_hydrated) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) _state = { ..._state, ...(JSON.parse(raw) as ReviewState) };
    } catch {}
    _hydrated = true;
  }

  let changed = false;

  if (!_state.firstLaunchAt) {
    _state.firstLaunchAt = Date.now();
    changed = true;
  }

  const day = today();
  if (!_state.sessionDays.includes(day)) {
    // Only the count matters — keep the array bounded.
    _state.sessionDays = [..._state.sessionDays, day].slice(-MIN_SESSION_DAYS);
    changed = true;
  }

  if (changed) persist();
}

/** Called once a track has been played for QUALIFIED_LISTEN_MS. Safe to call
 *  on every progress tick — repeat calls for the same track are ignored. */
export function noteQualifiedListen(trackId: string): void {
  if (!_hydrated) return;
  if (_countedTrackIds.has(trackId)) return;
  _countedTrackIds.add(trackId);
  _state.qualifiedListens++;
  persist();
}

export function isEligibleForReview(): boolean {
  if (!_hydrated) return false;
  if (_state.promptCount >= MAX_PROMPTS) return false;

  const version = currentVersion();
  if (version !== null && _state.lastPromptedVersion === version) return false;

  if (
    _state.lastPromptedAt !== null &&
    Date.now() - _state.lastPromptedAt < PROMPT_COOLDOWN_DAYS * MS_PER_DAY
  ) {
    return false;
  }

  const ageDays = _state.firstLaunchAt
    ? (Date.now() - _state.firstLaunchAt) / MS_PER_DAY
    : 0;
  const isLongTimeUser =
    ageDays >= USAGE_AGE_DAYS && _state.sessionDays.length >= MIN_SESSION_DAYS;
  const isEngagedListener = _state.qualifiedListens >= LISTEN_THRESHOLD;

  return isLongTimeUser || isEngagedListener;
}

/** Shows the native review sheet if the user is eligible and the OS is willing.
 *  The only caller of expo-store-review in the app. */
export async function maybeRequestReview(): Promise<void> {
  if (_promptInFlight) return;
  if (!isEligibleForReview()) return;
  if (AppState.currentState !== "active") return;

  _promptInFlight = true;
  try {
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    await StoreReview.requestReview();

    // The OS never reports whether the sheet was shown or a rating submitted,
    // so the attempt itself is what we record.
    _state.lastPromptedAt = Date.now();
    _state.promptCount++;
    _state.lastPromptedVersion = currentVersion();
    persist();
  } catch {
  } finally {
    _promptInFlight = false;
  }
}

/** Store page URL for the manual "Rate Qasid" entry in Settings. Null unless
 *  ios.appStoreUrl / android.playStoreUrl are configured in app.json. */
export function getStoreReviewUrl(): string | null {
  try {
    return StoreReview.storeUrl();
  } catch {
    return null;
  }
}

/** Testing helper — wipes all review state so the prompt can fire again. */
export async function resetReviewState(): Promise<void> {
  _state = {
    firstLaunchAt: 0,
    sessionDays: [],
    qualifiedListens: 0,
    lastPromptedAt: null,
    promptCount: 0,
    lastPromptedVersion: null,
  };
  _countedTrackIds.clear();
  _hydrated = false;
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  await initReviewTracking();
}
