import { Stack } from "expo-router";
import { GOLD } from "../../../constants/colors";
import { useEffect, useRef } from "react";
import { useAudioPlayer } from "../../../context/AudioPlayerContext";
import {
  consumeManualPlayFlag,
  incrementNasheedCount,
} from "../../../hooks/useNasheedLimit";
import { useUserStore } from "../../../stores/userStore";

export default function NasheedLayout() {
  const { currentTrack } = useAudioPlayer();
  const { currentPlan } = useUserStore();
  const prevTrackIdRef = useRef<string | null>(null);

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
    if (currentPlan === "free") {
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
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="all-artists" options={{ title: "All Artists" }} />
        <Stack.Screen
          name="artist/[id]"
          options={{ title: "Artist", headerBackTitle: "Artists" }}
        />
        <Stack.Screen
          name="playlist/[id]"
          options={{ title: "Playlist", headerBackTitle: "Playlists" }}
        />
    </Stack>
  );
}
