import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import {
  consumeManualPlayFlag,
  incrementNasheedCount,
} from "./useNasheedLimit";
import { useIsPremium, useUserStore } from "../stores/userStore";
import { useFavoritesStore } from "../stores/favoritesStore";

/**
 * The free tier's nasheed guards: auto-advances count against the daily
 * limit, and a free user's nasheed stops when the app goes to the background.
 *
 * Mount once, in app/(tabs)/_layout.tsx. Nasheeds play from every tab (the
 * Library, Quran-tab playlists), and a tab's own layout only exists once that
 * tab has been opened, so the guards cannot live in the Nasheeds layout.
 */
export function useNasheedPlaybackGuards(): void {
  const { currentTrack, clearPlayback } = useAudioPlayer();
  const { planResolved } = useUserStore();
  const isPremium = useIsPremium();

  const prevTrackIdRef = useRef<string | null>(null);

  // Safety net for cold starts and deep links that skip the auth screen's
  // prefetch: the hearts on every tab read this store. No-ops once hydrated.
  useEffect(() => {
    void useFavoritesStore
      .getState()
      .hydrate()
      .catch(() => {});
  }, []);

  // Kept in sync so the AppState callback below reads the live track instead of
  // a stale closure value (the listener is only re-subscribed on plan changes).
  const currentTrackRef = useRef(currentTrack);
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    // Wait until RevenueCat has reported the real entitlement before treating
    // the user as free. Otherwise a premium user is briefly seen as "free"
    // during RC init / after a cold start, and locking the screen in that
    // window would wrongly stop their background audio.
    if (!planResolved || isPremium) return;

    const subscription = AppState.addEventListener(
      "change",
      async (nextState: AppStateStatus) => {
        // Only nasheeds are gated in the background; Quran keeps playing.
        // Only "background" — NOT "inactive". "inactive" also fires on transient
        // states (Control Center, notification banner, incoming-call UI), which
        // would wrongly destroy a free user's playback during those moments.
        if (nextState === "background" && currentTrackRef.current?.isNasheed) {
          // reset() (inside clearPlayback) — not stop() — so the native
          // lock-screen mini player / now-playing widget is removed too.
          await clearPlayback();
        }
      },
    );
    return () => subscription.remove();
  }, [isPremium, planResolved, clearPlayback]);

  useEffect(() => {
    const currentId = currentTrack?.id ?? null;

    if (!currentTrack?.isNasheed) {
      prevTrackIdRef.current = currentId;
      return;
    }

    const prevId = prevTrackIdRef.current;
    prevTrackIdRef.current = currentId;

    if (prevId === null || prevId === currentId) return;

    // Manual tap — screen already called increment(), skip
    if (consumeManualPlayFlag()) return;

    // Auto-advance: count the play (queue is pre-capped so limit can't be exceeded)
    if (!isPremium) {
      void incrementNasheedCount();
    }
  }, [currentTrack?.id, currentTrack?.isNasheed, isPremium]);
}
