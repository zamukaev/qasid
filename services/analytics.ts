import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useReducer } from "react";
import { getApp } from "@react-native-firebase/app";
import {
  getAnalytics,
  logEvent,
  setAnalyticsCollectionEnabled,
  setUserId,
  setUserProperty,
} from "@react-native-firebase/analytics";
import type { SubscriptionPlan } from "../stores/userStore";

/**
 * Firebase Analytics mirror of the playback events that already land in the
 * `reciter_plays` / `artist_plays` Firestore collections. Firestore stays the
 * source of truth for recommendations and trending; Analytics only gives the
 * funnel view (started → qualified → completed) in the GA4 console.
 *
 * Every function here swallows its errors: analytics must never break or delay
 * playback, and never propagate into the Firestore write it accompanies.
 */

/** Mirrors the `eventType` union used by the Firestore playback writes. */
export type PlaybackEventType = "started" | "qualified" | "completed";

const QURAN_PLAYBACK_EVENT = "quran_playback";
const NASHEED_PLAYBACK_EVENT = "nasheed_playback";
const PLAN_USER_PROPERTY = "subscription_plan";
const STORAGE_KEY = "@qasid-analytics-consent";

/**
 * Opt-out default, matching the notification prefs: collection runs until the
 * user turns it off in Settings. Flipping this to `false` makes analytics
 * opt-in — but note that without a consent prompt on first launch nothing
 * would ever be collected, since Settings is the only way to say yes.
 */
const DEFAULT_ANALYTICS_ENABLED = true;

// Module-level singleton so the Settings screen and the launch wiring share one
// state, mirroring services/notifications-service.ts.
let _enabled = DEFAULT_ANALYTICS_ENABLED;
let _decided = false;
let _hydrated = false;
const _listeners = new Set<() => void>();

type EventParams = Record<string, string | number>;

function notify(): void {
  _listeners.forEach((fn) => fn());
}

/**
 * Pushes the choice down to the native SDK, which also stops the automatic
 * events (session_start, app_open) that never pass through this module.
 */
async function applyCollection(enabled: boolean): Promise<void> {
  try {
    await setAnalyticsCollectionEnabled(getAnalytics(getApp()), enabled);
  } catch (error) {
    console.warn("Failed to apply analytics collection state", error);
  }
}

async function logSafely(name: string, params: EventParams): Promise<void> {
  // Guards the JS side even before hydration has pushed the stored choice to
  // the native SDK, so a declined user cannot leak an event on a cold start.
  if (!_enabled) return;

  try {
    await logEvent(getAnalytics(getApp()), name, params);
  } catch (error) {
    console.warn(`Failed to log analytics event "${name}"`, error);
  }
}

export function logQuranPlayback({
  reciterId,
  surahId,
  eventType,
  playedSeconds,
}: {
  reciterId: string;
  surahId: string;
  eventType: PlaybackEventType;
  playedSeconds: number;
}): Promise<void> {
  return logSafely(QURAN_PLAYBACK_EVENT, {
    reciter_id: reciterId,
    surah_id: surahId,
    event_type: eventType,
    played_seconds: playedSeconds,
  });
}

export function logNasheedPlayback({
  artistId,
  nasheedId,
  eventType,
  playedSeconds,
}: {
  artistId: string;
  nasheedId: string;
  eventType: PlaybackEventType;
  playedSeconds: number;
}): Promise<void> {
  return logSafely(NASHEED_PLAYBACK_EVENT, {
    artist_id: artistId,
    nasheed_id: nasheedId,
    event_type: eventType,
    played_seconds: playedSeconds,
  });
}

/**
 * Ties subsequent events to the signed-in account. Pass `null` on sign-out so
 * the next session is not attributed to the previous user.
 */
export async function setAnalyticsUser(userId: string | null): Promise<void> {
  if (!_enabled) return;

  try {
    await setUserId(getAnalytics(getApp()), userId);
  } catch (error) {
    console.warn("Failed to set analytics user id", error);
  }
}

/** Registers the plan as a user property so events can be split free vs. paid. */
export async function setAnalyticsPlan(plan: SubscriptionPlan): Promise<void> {
  if (!_enabled) return;

  try {
    await setUserProperty(getAnalytics(getApp()), PLAN_USER_PROPERTY, plan);
  } catch (error) {
    console.warn("Failed to set analytics subscription plan", error);
  }
}

/**
 * Records an explicit choice from Settings. Turning collection off also clears
 * the user id, so the pseudonymous app-instance id left behind stops being
 * linked to the account.
 */
export async function setAnalyticsEnabled(next: boolean): Promise<void> {
  _enabled = next;
  _decided = true;
  notify();

  await applyCollection(next);

  if (!next) {
    try {
      await setUserId(getAnalytics(getApp()), null);
    } catch {
      // Collection is already off; an unlinked id is not worth surfacing.
    }
  }

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: next }));
  } catch (error) {
    console.warn("Failed to persist analytics consent", error);
  }
}

/**
 * Called once at app launch, before auth. Restores the stored choice and pushes
 * it to the native SDK; with no stored choice the shipped default applies.
 */
export async function hydrateAnalyticsConsent(): Promise<void> {
  if (_hydrated) return;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as { enabled?: unknown };
      if (typeof data.enabled === "boolean") {
        _enabled = data.enabled;
        _decided = true;
      }
    }
  } catch (error) {
    // A broken record must not silently flip collection on: keep the default
    // but surface it, since that is a real failure rather than a fresh install.
    console.error("hydrateAnalyticsConsent failed:", error);
  }

  _hydrated = true;
  notify();
  await applyCollection(_enabled);
}

/** Settings-screen binding for the consent toggle. */
export function useAnalyticsPrefs() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    _listeners.add(rerender);
    void hydrateAnalyticsConsent();
    return () => {
      _listeners.delete(rerender);
    };
  }, []);

  return {
    analyticsEnabled: _enabled,
    /** False until the user has explicitly chosen — for a future consent prompt. */
    analyticsDecided: _decided,
    hydrated: _hydrated,
    setAnalyticsEnabled,
  };
}
