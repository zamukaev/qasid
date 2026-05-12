import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { NasheedArtist } from "../types/nasheed";
import HomeSectionShell from "./HomeSectionShell";
import { useReciterImageSource } from "../hooks/useReciterImageSource";

const CARD_GAP = 0;
const TEXT_AREA = 52;

function resolveSize(large?: boolean, small?: boolean) {
  if (large) return { cardWidth: 148, imageSize: 136 };
  if (small) return { cardWidth: 84, imageSize: 72 };
  return { cardWidth: 116, imageSize: 104 };
}

interface CardVariantProps {
  large?: boolean;
  small?: boolean;
}

function CompactArtistCardSkeleton({ large, small }: CardVariantProps) {
  const { cardWidth, imageSize } = resolveSize(large, small);
  return (
    <View style={{ width: cardWidth }} className="items-center">
      <View
        className="rounded-xl bg-gray-700/30 animate-pulse mb-2"
        style={{ width: imageSize, height: imageSize }}
      />
      <View className="h-3 w-20 bg-gray-700/30 rounded animate-pulse" />
    </View>
  );
}

function ArtistBrowseCard({
  artist,
  large,
  small,
}: { artist: NasheedArtist } & CardVariantProps) {
  const router = useRouter();
  const imageSource = useReciterImageSource(artist.image_path);
  const { cardWidth, imageSize } = resolveSize(large, small);

  return (
    <Pressable
      className="items-center active:opacity-80"
      android_ripple={{ color: "#C9A84C20" }}
      onPress={() =>
        router.push({
          pathname: "/(tabs)/nasheeds/artist/[id]",
          params: { id: artist.id },
        })
      }
    >
      <View
        className="rounded-xl overflow-hidden border border-qasid-gold/20 mb-2"
        style={{
          width: imageSize,
          height: imageSize,
          shadowColor: "#C9A84C",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 5,
        }}
      >
        <Image
          source={imageSource}
          className="w-full h-full"
          resizeMode="cover"
        />
      </View>
      <Text
        className={`text-white/90 text-center leading-4 ${large ? "text-sm" : "text-xs"}`}
        numberOfLines={2}
        style={{ width: cardWidth }}
      >
        {artist.name_en}
      </Text>
    </Pressable>
  );
}

interface BrowseAllArtistsPreviewProps extends CardVariantProps {
  artists: NasheedArtist[];
  isLoading?: boolean;
}

function BrowseAllArtistsPreview({
  artists,
  isLoading = false,
  large,
  small,
}: BrowseAllArtistsPreviewProps) {
  const router = useRouter();
  const { cardWidth, imageSize } = resolveSize(large, small);
  const rowHeight = imageSize + TEXT_AREA;

  if (!isLoading && artists.length === 0) return null;

  const items = isLoading ? Array.from({ length: 20 }, (_, i) => i) : artists;

  const rows = isLoading || artists.length > 6 ? 2 : 1;
  const totalColumns = Math.ceil(items.length / rows);
  const containerWidth = totalColumns * (cardWidth + CARD_GAP);
  const containerHeight = rows * rowHeight;

  return (
    <HomeSectionShell
      title="Explore Artists"
      onPressSeeAll={() => router.push("/(tabs)/nasheeds/all-artists")}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4"
        contentContainerStyle={{ paddingLeft: 16, paddingRight: 0 }}
      >
        <View style={{ width: containerWidth, height: containerHeight }}>
          {items.map((item, index) => {
            const row = index % rows;
            const column = Math.floor(index / rows);

            return (
              <View
                key={
                  typeof item === "number"
                    ? `browse-artist-skeleton-${index}`
                    : item.id
                }
                style={{
                  position: "absolute",
                  left: column * (cardWidth + CARD_GAP),
                  top: row * rowHeight,
                }}
              >
                {typeof item === "number" ? (
                  <CompactArtistCardSkeleton large={large} small={small} />
                ) : (
                  <ArtistBrowseCard artist={item} large={large} small={small} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </HomeSectionShell>
  );
}

export default React.memo(BrowseAllArtistsPreview);
