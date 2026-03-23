import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAudioPlayer } from "../context/AudioPlayerContext";
import { Progressbar } from "./Progressbar";

export default function ContinueListeningBlock() {
  const router = useRouter();
  const {
    currentTrack,
    positionMillis,
    resume,
    pause,
    isPlaying,
    durationMillis,
    playTrack,
  } = useAudioPlayer();

  const hasHistory = Boolean(currentTrack);

  const progressPercent = useMemo(() => {
    if (!durationMillis) return 0;
    return Math.max(
      0,
      Math.min(100, Math.round((positionMillis / durationMillis) * 100)),
    );
  }, [positionMillis, durationMillis]);

  const handlePress = async () => {
    if (hasHistory) {
      if (!isPlaying) {
        await resume();
      }
      if (isPlaying) {
        await pause();
      }
      return;
    }

    router.push("/(tabs)/quran/all-reciters");
  };

  return (
    <View className="px-4 pt-6 pb-5">
      <View className="relative overflow-hidden rounded-[30px] border border-qasid-gold/20 bg-qasid-bg-2 shadow-black/30">
        <LinearGradient
          colors={[
            "rgba(231,193,28,0.22)",
            "rgba(231,193,28,0.08)",
            "rgba(0,0,0,0.0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View className="absolute inset-0 rounded-3xl border border-white/10" />

        <View className="px-5 py-6">
          <View className="mb-4 self-start rounded-full border border-qasid-gold/15 bg-qasid-black/40 px-3 py-1.5">
            <Text className="text-qasid-gold text-[10px] font-semibold uppercase tracking-[2px]">
              {hasHistory ? "Continue listening" : "Start here"}
            </Text>
          </View>

          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-qasid-white text-[30px] leading-9 font-bold tracking-tight">
                {hasHistory ? "Continue Listening" : "Play Quran"}
              </Text>
              <Text className="mt-2 text-white/60 text-[15px] leading-6">
                {hasHistory
                  ? "Continue from where you left off."
                  : "Browse reciters and start a new recitation."}
              </Text>
            </View>

            <View className="h-14 w-14 items-center justify-center rounded-full bg-qasid-gold/15 border border-qasid-gold/25">
              {!hasHistory ? (
                <Pressable
                  onPress={handlePress}
                  android_ripple={{ color: "#E7C11C22" }}
                  style={({ pressed }) => [
                    {
                      opacity: pressed ? 0.94 : 1,
                      transform: [{ scale: pressed ? 0.992 : 1 }],
                    },
                  ]}
                >
                  <Ionicons
                    name={"library-outline"}
                    size={24}
                    color="#E7C11C"
                  />
                </Pressable>
              ) : (
                <Pressable
                  onPress={handlePress}
                  android_ripple={{ color: "#E7C11C22" }}
                  style={({ pressed }) => [
                    {
                      opacity: pressed ? 0.94 : 1,
                      transform: [{ scale: pressed ? 0.992 : 1 }],
                    },
                  ]}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={24}
                    color="#E7C11C"
                  />
                </Pressable>
              )}
            </View>
          </View>

          {hasHistory ? (
            <View className="mt-6">
              <Text
                className="text-qasid-gold text-xl font-semibold"
                numberOfLines={1}
              >
                {currentTrack?.title}
              </Text>
              {currentTrack?.artist ? (
                <Text className="mt-1 text-white/55 text-sm" numberOfLines={1}>
                  {currentTrack.artist}
                </Text>
              ) : null}

              {durationMillis > 0 ? (
                <View className="mt-4">
                  <Progressbar
                    progressPercent={progressPercent}
                    resumeMillis={positionMillis}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="mt-6 self-start flex-row items-center rounded-2xl bg-qasid-gold px-4 py-3">
            <Ionicons
              name={hasHistory ? "musical-notes" : "search"}
              size={16}
              color="#090A07"
            />
            {hasHistory ? (
              <Pressable
                onPress={handlePress}
                android_ripple={{ color: "#E7C11C22" }}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.94 : 1,
                    transform: [{ scale: pressed ? 0.992 : 1 }],
                  },
                ]}
                className="ml-2 text-qasid-black font-semibold"
              >
                <Text>
                  {isPlaying ? "Pause Listening" : "Resume Listening"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handlePress}
                android_ripple={{ color: "#E7C11C22" }}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.94 : 1,
                    transform: [{ scale: pressed ? 0.992 : 1 }],
                  },
                ]}
                className="ml-2 text-qasid-black font-semibold"
              >
                <Text>Browse Reciters</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
