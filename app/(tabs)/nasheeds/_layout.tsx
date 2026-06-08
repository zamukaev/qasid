import { Stack } from "expo-router";
import { GOLD } from "../../../constants/colors";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAudioPlayer } from "../../../context/AudioPlayerContext";
import {
  consumeManualPlayFlag,
  incrementNasheedCount,
} from "../../../hooks/useNasheedLimit";
import { useUserStore } from "../../../stores/userStore";

export default function NasheedLayout() {
  const { currentTrack, clearPlayback } = useAudioPlayer();
  const { user, currentPlan, planResolved } = useUserStore();

  const prevTrackIdRef = useRef<string | null>(null);

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
    if (
      !planResolved ||
      currentPlan !== "free" ||
      user?.email === "abu.safiia2016@gmail.com"
    )
      return;

    const subscription = AppState.addEventListener(
      "change",
      async (nextState: AppStateStatus) => {
        // Only nasheeds are gated in the background. Tab layouts stay mounted
        // once visited, so without this guard the listener would also stop
        // Quran playback after the user has visited the nasheeds tab.
        if (
          (nextState === "background" || nextState === "inactive") &&
          currentTrackRef.current?.isNasheed
        ) {
          // reset() (inside clearPlayback) — not stop() — so the native
          // lock-screen mini player / now-playing widget is removed too.
          await clearPlayback();
        }
      },
    );
    return () => subscription.remove();
  }, [currentPlan, planResolved, clearPlayback]);

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
    if (currentPlan === "free" && user?.email !== "abu.safiia2016@gmail.com") {
      void incrementNasheedCount();
    }
  }, [currentTrack?.id, currentTrack?.isNasheed, currentPlan]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#090A07" },
        headerTintColor: GOLD,
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="all-artists" options={{ title: "All Artists" }} />
      <Stack.Screen
        name="artist/[id]"
        options={{
          title: "Artist",
        }}
      />
      <Stack.Screen name="playlist/[id]" options={{ title: "Playlist" }} />
    </Stack>
  );
}
