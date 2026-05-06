import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { NasheedArtist } from "../types/nasheed";
import HomeSectionShell from "./HomeSectionShell";
import { useReciterImageSource } from "../hooks/useReciterImageSource";

const CARD_WIDTH = 100;
const CARD_GAP = 0;
const ROW_HEIGHT = 140;

function CompactArtistCardSkeleton() {
  return (
    <View style={{ width: CARD_WIDTH }} className="items-center">
      <View
        className="rounded-xl bg-gray-700/30 animate-pulse mb-2"
        style={{ width: 88, height: 88 }}
      />
      <View className="h-3 w-20 bg-gray-700/30 rounded animate-pulse" />
    </View>
  );
}

function ArtistBrowseCard({ artist }: { artist: NasheedArtist }) {
  const router = useRouter();
  const imageSource = useReciterImageSource(artist.image_path);

  return (
    <Pressable
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
        className="rounded-xl overflow-hidden border border-qasid-gold/20 mb-2"
        style={{
          width: 88,
          height: 88,
          shadowColor: "#E7C11C",
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
        className="text-white/90 text-center text-xs leading-4"
        numberOfLines={2}
        style={{ width: CARD_WIDTH }}
      >
        {artist.name_en}
      </Text>
    </Pressable>
  );
}

interface BrowseAllArtistsPreviewProps {
  artists: NasheedArtist[];
  isLoading?: boolean;
}

function BrowseAllArtistsPreview({
  artists,
  isLoading = false,
}: BrowseAllArtistsPreviewProps) {
  const router = useRouter();

  if (!isLoading && artists.length === 0) return null;

  const items = isLoading ? Array.from({ length: 20 }, (_, i) => i) : artists;

  const rows = isLoading || artists.length > 6 ? 2 : 1;
  const totalColumns = Math.ceil(items.length / rows);
  const containerWidth = totalColumns * (CARD_WIDTH + CARD_GAP);
  const containerHeight = rows * ROW_HEIGHT;

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
                  left: column * (CARD_WIDTH + CARD_GAP),
                  top: row * ROW_HEIGHT,
                }}
              >
                {typeof item === "number" ? (
                  <CompactArtistCardSkeleton />
                ) : (
                  <ArtistBrowseCard artist={item} />
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
