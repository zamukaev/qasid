import { Pressable, Text, View, Image } from "react-native";
import { GOLD, GOLD_RIPPLE_20 } from "../constants/colors";

import { FirebaseReciter } from "../types/quran";
import { useRouter } from "expo-router";
import { useReciterImageSource } from "../hooks/useReciterImageSource";

interface ReciterCardProps {
  reciter: FirebaseReciter;
}

const getReciterDisplayName = (reciter: FirebaseReciter) =>
  reciter.name_en?.trim() || reciter.name_ar?.trim() || "Unknown reciter";

export default function ReciterCard({ reciter }: ReciterCardProps) {
  const router = useRouter();
  const imageSource = useReciterImageSource(reciter.image_path);
  const displayName = getReciterDisplayName(reciter);
  const handlePress = () => {
    router.push({
      pathname: "/(tabs)/quran/reciter/[id]",
      params: { id: reciter.id.toString() },
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row  items-center justify-between rounded-2xl  border border-qasid-gold/25 p-4"
      android_ripple={{ color: GOLD_RIPPLE_20 }}
    >
      <View className="rounded-full mr-6">
        {imageSource ? (
          <Image
            className="h-16 w-16 rounded-full  border border-qasid-gold/25 "
            source={imageSource}
          />
        ) : (
          <View className="flex-1 border bg-qasid-gray border-qasid-gold/25 items-center justify-center h-16 w-16 rounded-full">
            <Text className="text-qasid-gold font-semibold text-3xl">
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-qasid-white font-semibold text-lg">
          {displayName}
        </Text>
        <Text className="text-qasid-gold font-light text-base opacity-[0.8]">
          {reciter.name_ar}
        </Text>
      </View>
    </Pressable>
  );
}

type CardSize = { cardWidth: number; imageSize: number };

function resolveSize(large?: boolean, small?: boolean): CardSize {
  if (large) return { cardWidth: 116, imageSize: 104 };
  if (small) return { cardWidth: 84, imageSize: 72 };
  return { cardWidth: 100, imageSize: 88 };
}

export interface CompactReciterCardVariantProps {
  circle?: boolean;
  large?: boolean;
  small?: boolean;
}

interface CompactReciterCardProps extends CompactReciterCardVariantProps {
  reciter: FirebaseReciter;
}

export function CompactReciterCard({ reciter, circle, large, small }: CompactReciterCardProps) {
  const router = useRouter();
  const imageSource = useReciterImageSource(reciter.image_path);
  const displayName = getReciterDisplayName(reciter);
  const { cardWidth, imageSize } = resolveSize(large, small);

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/(tabs)/quran/reciter/[id]",
          params: { id: reciter.id.toString() },
        })
      }
      className="items-center active:opacity-80"
      android_ripple={{ color: GOLD_RIPPLE_20 }}
      style={{ width: cardWidth }}
    >
      <View
        className={`${circle ? "rounded-full" : "rounded-xl"} overflow-hidden border border-qasid-gold/20 mb-2`}
        style={{
          width: imageSize,
          height: imageSize,
          shadowColor: GOLD,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: circle ? 0.3 : 0.2,
          shadowRadius: circle ? 8 : 6,
          elevation: circle ? 8 : 5,
        }}
      >
        <Image
          source={imageSource}
          className="w-full h-full"
          resizeMode="cover"
        />
      </View>
      <Text
        className="text-white/90 text-center text-xs leading-4"
        numberOfLines={2}
      >
        {displayName}
      </Text>
    </Pressable>
  );
}
