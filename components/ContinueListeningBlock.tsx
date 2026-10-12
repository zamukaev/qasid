import { Image, Pressable, Text, View } from "react-native";
import { GOLD, GOLD_RIPPLE } from "../constants/colors";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAudioPlayer } from "../context/AudioPlayerContext";
import { QasidLiveEqualizer } from "./QasidLiveEqualizer";

type Variant = "quran" | "nasheeds";

const ARTWORK_SIZE = 56;
const ICON_SIZE = 20;
const PRESSED_OPACITY = 0.85;
const EQUALIZER = {
  bars: 6,
  minHeight: 4,
  maxHeight: 26,
  barWidth: 3,
  gap: 3,
} as const;

const VARIANT_CONFIG: Record<
  Variant,
  {
    emptyTitle: string;
    emptyDescription: string;
    emptyIcon: keyof typeof Ionicons.glyphMap;
    emptyRoute: string;
  }
> = {
  quran: {
    emptyTitle: "Play Quran",
    emptyDescription: "Browse reciters and start a recitation",
    emptyIcon: "book-outline",
    emptyRoute: "/(tabs)/quran/all-reciters",
  },
  nasheeds: {
    emptyTitle: "Play Nasheeds",
    emptyDescription: "Browse artists and start listening",
    emptyIcon: "musical-notes-outline",
    emptyRoute: "/(tabs)/nasheeds/all-artists",
  },
};

function artworkUriOf(artwork: unknown): string | null {
  if (typeof artwork === "string") return artwork;
  if (
    artwork &&
    typeof artwork === "object" &&
    "uri" in artwork &&
    typeof artwork.uri === "string"
  ) {
    return artwork.uri;
  }
  return null;
}

export default function ContinueListeningBlock({
  variant = "quran",
}: {
  variant?: Variant;
}) {
  const router = useRouter();
  const { currentTrack, isPlaying, setViewMode } = useAudioPlayer();

  const config = VARIANT_CONFIG[variant];

  if (!currentTrack) {
    return (
      <View className="px-4 pt-6 pb-5">
        <Pressable
          onPress={() =>
            router.push(config.emptyRoute as Parameters<typeof router.push>[0])
          }
          android_ripple={{ color: GOLD_RIPPLE }}
          accessibilityRole="button"
          accessibilityLabel={`${config.emptyTitle}. ${config.emptyDescription}`}
          style={({ pressed }) => ({ opacity: pressed ? PRESSED_OPACITY : 1 })}
          className="flex-row items-center overflow-hidden rounded-2xl border border-qasid-gold/20 bg-qasid-bg-2 p-3"
        >
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-qasid-gold/15">
            <Ionicons name={config.emptyIcon} size={ICON_SIZE} color={GOLD} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-qasid-white text-base font-semibold">
              {config.emptyTitle}
            </Text>
            <Text className="mt-0.5 text-white/55 text-sm" numberOfLines={1}>
              {config.emptyDescription}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={ICON_SIZE} color={GOLD} />
        </Pressable>
      </View>
    );
  }

  const artUri = artworkUriOf(currentTrack.artworkUri);

  return (
    <View className="px-4 pt-6 pb-5">
      <Text className="mb-2 text-qasid-gold text-[11px] font-semibold uppercase tracking-[1.5px]">
        {isPlaying ? "Now playing" : "Continue listening"}
      </Text>

      <Pressable
        onPress={() => setViewMode("full")}
        android_ripple={{ color: GOLD_RIPPLE }}
        accessibilityRole="button"
        accessibilityLabel={`Open player: ${currentTrack.title}`}
        style={({ pressed }) => ({ opacity: pressed ? PRESSED_OPACITY : 1 })}
        className="overflow-hidden rounded-2xl border border-qasid-gold/20 bg-qasid-bg-2"
      >
        <View className="flex-row items-center p-3">
          <View
            className="items-center justify-center overflow-hidden rounded-xl bg-qasid-gold/15"
            style={{ width: ARTWORK_SIZE, height: ARTWORK_SIZE }}
          >
            {artUri ? (
              <Image
                source={{ uri: artUri }}
                style={{ width: ARTWORK_SIZE, height: ARTWORK_SIZE }}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="musical-notes" size={ICON_SIZE} color={GOLD} />
            )}
          </View>

          <View className="ml-3 mr-2 flex-1 flex-row items-center">
            <View className="shrink">
              <Text
                className="text-qasid-white text-base font-semibold"
                numberOfLines={1}
              >
                {currentTrack.title}
              </Text>
              {currentTrack.artist ? (
                <Text
                  className="mt-0.5 text-white/55 text-sm"
                  numberOfLines={1}
                >
                  {currentTrack.artist}
                </Text>
              ) : null}
            </View>

            {isPlaying ? (
              <QasidLiveEqualizer
                status="playing"
                {...EQUALIZER}
                className="ml-4 shrink-0"
              />
            ) : null}
          </View>

          <Ionicons name="chevron-forward" size={ICON_SIZE} color={GOLD} />
        </View>
      </Pressable>
    </View>
  );
}
