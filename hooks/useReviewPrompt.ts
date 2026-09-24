import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { maybeRequestReview } from "../services/review-service";
import type { PlayerViewMode } from "../context/AudioPlayerContext";

/** Breathing room after the app becomes visible, so the sheet never lands
 *  while the first screen is still settling. */
const PROMPT_DELAY_MS = 4000;

/**
 * Asks for a store review at calm moments only — when the app is opened and
 * when it returns to the foreground. Never at the instant a threshold is
 * crossed: a listen that qualifies mid-session surfaces the sheet on the next
 * app open instead of interrupting playback.
 *
 * Mount once, globally (app/(tabs)/_layout.tsx). `maybeRequestReview` owns all
 * eligibility and cooldown checks, so extra calls are harmless.
 */
export function useReviewPrompt(viewMode: PlayerViewMode): void {
  // Read without re-arming the effects on every view-mode change.
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  useEffect(() => {
    const schedule = () =>
      setTimeout(() => {
        // Don't cover the immersive full-screen player.
        if (viewModeRef.current === "full") return;
        void maybeRequestReview();
      }, PROMPT_DELAY_MS);

    let timer = schedule();

    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      clearTimeout(timer);
      timer = schedule();
    });

    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
}
