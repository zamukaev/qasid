import React from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { FirebaseReciter } from "../types/quran";
import { CompactReciterCard } from "./ReciterCard";
import CompactReciterCardSkeleton from "./CompactReciterCardSkeleton";
import HomeSectionShell from "./HomeSectionShell";

interface BrowseAllRecitersPreviewProps {
  reciters: FirebaseReciter[];
  isLoading?: boolean;
}

function BrowseAllRecitersPreview({
  reciters,
  isLoading = false,
}: BrowseAllRecitersPreviewProps) {
  const router = useRouter();

  if (!isLoading && reciters.length === 0) {
    return null;
  }

  const items = isLoading
    ? Array.from({ length: 20 }, (_, index) => index)
    : reciters;
  const useTwoRows = isLoading || reciters.length > 6;
  const rows = useTwoRows ? 2 : 1;
  const cardWidth = 100;
  const cardGap = 0;
  const rowHeight = 140;
  const totalColumns = Math.ceil(items.length / rows);
  const containerWidth = totalColumns * (cardWidth + cardGap);
  const containerHeight = rows * rowHeight;

  const handleOpenAllReciters = () => {
    router.push("/(tabs)/quran/all-reciters");
  };

  return (
    <HomeSectionShell
      title="Explore Reciters"
      onPressSeeAll={handleOpenAllReciters}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4"
        contentContainerStyle={{
          paddingLeft: 16,
          paddingRight: 0,
        }}
      >
        <View style={{ width: containerWidth, height: containerHeight }}>
          {items.map((item, index) => {
            const row = index % rows;
            const column = Math.floor(index / rows);

            return (
              <View
                key={
                  typeof item === "number"
                    ? `browse-skeleton-${index}`
                    : item.id.toString()
                }
                style={{
                  position: "absolute",
                  left: column * (cardWidth + cardGap),
                  top: row * rowHeight,
                }}
              >
                {typeof item === "number" ? (
                  <CompactReciterCardSkeleton />
                ) : (
                  <CompactReciterCard reciter={item} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </HomeSectionShell>
  );
}

export default React.memo(BrowseAllRecitersPreview);
