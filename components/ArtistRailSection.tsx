import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { GOLD, GOLD_RIPPLE_20 } from "../constants/colors";
import { useRouter } from "expo-router";
import { NasheedArtist, Playlist } from "../types/nasheed";
import { useImageLoadState } from "../hooks/useImageLoadState";
import HorizontalRailSection from "./HorizontalRailSection";
import CompactArtistCardSkeleton from "./CompactArtistCardSkeleton";
import ImageShimmerOverlay from "./ImageShimmerOverlay";

type CardSize = { cardWidth: number; imageSize: number };

function resolveSize(large?: boolean, small?: boolean): CardSize {
  if (large) return { cardWidth: 148, imageSize: 136 };
  if (small) return { cardWidth: 84, imageSize: 72 };
  return { cardWidth: 116, imageSize: 104 };
}

interface CardVariantProps {
  circle?: boolean;
  large?: boolean;
  small?: boolean;
}

interface CompactArtistCardProps extends CardVariantProps {
  artist: NasheedArtist | Playlist;
  onPress?: (id: string) => void;
}

function CompactArtistCard({
  artist,
  circle,
  large,
  small,
  onPress,
}: CompactArtistCardProps) {
  const router = useRouter();
  const { source, showSkeleton, onLoad, onError } = useImageLoadState(
    artist.image_path,
  );
  const { cardWidth, imageSize } = resolveSize(large, small);

  return (
    <Pressable
      style={{ width: cardWidth }}
      className="items-center active:opacity-80"
      android_ripple={{ color: GOLD_RIPPLE_20 }}
      onPress={() =>
        onPress
          ? onPress(artist.id)
          : router.push({
              pathname: "/(tabs)/nasheeds/artist/[id]",
              params: { id: artist.id },
            })
      }
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
          source={source}
          onLoad={onLoad}
          onError={onError}
          className="w-full h-full"
          resizeMode="cover"
        />
        <ImageShimmerOverlay
          visible={showSkeleton}
          rounded={circle ? "full" : "xl"}
        />
      </View>
      <Text
        className={`text-white/90 text-center leading-4 ${large ? "text-sm" : "text-xs"}`}
        numberOfLines={2}
      >
        {artist.name_en}
      </Text>
    </Pressable>
  );
}

interface ArtistRailSectionProps extends CardVariantProps {
  title: string;
  artists: NasheedArtist[] | Playlist[];
  isLoading?: boolean;
  onPressSeeAll?: () => void;
  onPressItem?: (id: string) => void;
  skeletonCount?: number;
}

function ArtistRailSection({
  title,
  artists,
  isLoading = false,
  onPressSeeAll,
  onPressItem,
  skeletonCount = 8,
  circle,
  large,
  small,
}: ArtistRailSectionProps) {
  return (
    <HorizontalRailSection
      title={title}
      items={artists}
      isLoading={isLoading}
      onPressSeeAll={onPressSeeAll}
      skeletonCount={skeletonCount}
      keyExtractor={(a) => a.id}
      renderItem={(a) => (
        <CompactArtistCard
          artist={a}
          circle={circle}
          large={large}
          small={small}
          onPress={onPressItem}
        />
      )}
      renderSkeleton={(_) => (
        <CompactArtistCardSkeleton
          circle={circle}
          large={large}
          small={small}
        />
      )}
    />
  );
}

export default React.memo(ArtistRailSection);
