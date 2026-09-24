import { Pressable, Text, View, Image } from "react-native";
import { GOLD, GOLD_RIPPLE_20 } from "../constants/colors";

import { FirebaseReciter } from "../types/quran";
import { useRouter } from "expo-router";
import { useImageLoadState } from "../hooks/useImageLoadState";
import ImageShimmerOverlay from "./ImageShimmerOverlay";
import {
  CardVariantProps,
  CompactRailCard,
  RECITER_CARD_SIZES,
  resolveCardSize,
} from "./CompactRailCard";

interface ReciterCardProps {
  reciter: FirebaseReciter;
}

const getReciterDisplayName = (reciter: FirebaseReciter) =>
  reciter.name_en?.trim() || reciter.name_ar?.trim() || "Unknown reciter";

export default function ReciterCard({ reciter }: ReciterCardProps) {
  const router = useRouter();
  const { source, showSkeleton, onLoad, onError } = useImageLoadState(
    reciter.image_path,
  );
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
      <View className="rounded-full overflow-hidden mr-6 h-16 w-16">
        <Image
          className="h-16 w-16 rounded-full  border border-qasid-gold/25 "
          source={source}
          onLoad={onLoad}
          onError={onError}
        />
        <ImageShimmerOverlay visible={showSkeleton} rounded="full" />
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

export type CompactReciterCardVariantProps = CardVariantProps;

interface CompactReciterCardProps extends CardVariantProps {
  reciter: FirebaseReciter;
}

export function CompactReciterCard({
  reciter,
  circle,
  large,
  small,
}: CompactReciterCardProps) {
  const router = useRouter();
  const { cardWidth, imageSize } = resolveCardSize(
    { large, small },
    RECITER_CARD_SIZES,
  );

  return (
    <CompactRailCard
      imagePath={reciter.image_path}
      label={getReciterDisplayName(reciter)}
      cardWidth={cardWidth}
      imageSize={imageSize}
      circle={circle}
      onPress={() =>
        router.push({
          pathname: "/(tabs)/quran/reciter/[id]",
          params: { id: reciter.id.toString() },
        })
      }
    />
  );
}
