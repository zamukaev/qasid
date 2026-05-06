import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { NasheedArtist } from "../types/nasheed";
import HomeSectionShell from "./HomeSectionShell";
import { useReciterImageSource } from "../hooks/useReciterImageSource";

type CardSize = { cardWidth: number; imageSize: number };

function resolveSize(large?: boolean, small?: boolean): CardSize {
  if (large) return { cardWidth: 116, imageSize: 104 };
  if (small) return { cardWidth: 84, imageSize: 72 };
  return { cardWidth: 100, imageSize: 88 };
}

interface CardVariantProps {
  circle?: boolean;
  large?: boolean;
  small?: boolean;
}

function CompactArtistCardSkeleton({ circle, large, small }: CardVariantProps) {
  const { cardWidth, imageSize } = resolveSize(large, small);
  return (
    <View style={{ width: cardWidth }} className="items-center">
      <View
        className={`${circle ? "rounded-full" : "rounded-xl"} bg-gray-700/30 animate-pulse mb-2`}
        style={{ width: imageSize, height: imageSize }}
      />
      <View className="h-3 w-20 bg-gray-700/30 rounded mb-1 animate-pulse" />
      <View className="h-2 w-14 bg-gray-700/30 rounded animate-pulse" />
    </View>
  );
}

interface CompactArtistCardProps extends CardVariantProps {
  artist: NasheedArtist;
}

function CompactArtistCard({ artist, circle, large, small }: CompactArtistCardProps) {
  const router = useRouter();
  const imageSource = useReciterImageSource(artist.image_path);
  const { cardWidth, imageSize } = resolveSize(large, small);

  return (
    <Pressable
      style={{ width: cardWidth }}
      className="items-center active:opacity-80"
      android_ripple={{ color: "#E7C11C20" }}
      onPress={() =>
        router.push({
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
          shadowColor: "#E7C11C",
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
        {artist.name_en}
      </Text>
    </Pressable>
  );
}

interface ArtistRailSectionProps extends CardVariantProps {
  title: string;
  artists: NasheedArtist[];
  isLoading?: boolean;
  onPressSeeAll?: () => void;
  skeletonCount?: number;
}

function ArtistRailSection({
  title,
  artists,
  isLoading = false,
  onPressSeeAll,
  skeletonCount = 8,
  circle,
  large,
  small,
}: ArtistRailSectionProps) {
  const items = isLoading
    ? Array.from({ length: skeletonCount }, (_, i) => i)
    : artists;

  if (!isLoading && artists.length === 0) return null;

  return (
    <HomeSectionShell title={title} onPressSeeAll={onPressSeeAll}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4"
        contentContainerStyle={{ paddingLeft: 16, paddingRight: 0 }}
      >
        <View className="flex-row">
          {items.map((item, index) => (
            <View
              key={
                typeof item === "number"
                  ? `${title}-skeleton-${index}`
                  : item.id
              }
              className="mr-3"
            >
              {typeof item === "number" ? (
                <CompactArtistCardSkeleton circle={circle} large={large} small={small} />
              ) : (
                <CompactArtistCard artist={item} circle={circle} large={large} small={small} />
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </HomeSectionShell>
  );
}

export default React.memo(ArtistRailSection);
