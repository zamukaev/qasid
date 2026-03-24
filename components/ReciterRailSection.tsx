import React from "react";
import { ScrollView, View } from "react-native";

import { FirebaseReciter } from "../types/quran";
import { CompactReciterCard } from "./ReciterCard";
import CompactReciterCardSkeleton from "./CompactReciterCardSkeleton";
import HomeSectionShell from "./HomeSectionShell";

interface ReciterRailSectionProps {
  title: string;
  reciters: FirebaseReciter[];
  isLoading?: boolean;
  onPressSeeAll?: () => void;
  skeletonCount?: number;
}

function ReciterRailSection({
  title,
  reciters,
  isLoading = false,
  onPressSeeAll,
  skeletonCount = 8,
}: ReciterRailSectionProps) {
  const items = isLoading
    ? Array.from({ length: skeletonCount }, (_, index) => index)
    : reciters;

  if (!isLoading && reciters.length === 0) {
    return null;
  }

  return (
    <HomeSectionShell title={title} onPressSeeAll={onPressSeeAll}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4"
        contentContainerStyle={{
          paddingLeft: 16,
          paddingRight: 0,
        }}
      >
        <View className="flex-row">
          {items.map((item, index) => (
            <View
              key={
                typeof item === "number"
                  ? `${title.toLowerCase()}-skeleton-${index}`
                  : item.id.toString()
              }
              className="mr-3"
            >
              {typeof item === "number" ? (
                <CompactReciterCardSkeleton />
              ) : (
                <CompactReciterCard reciter={item} />
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </HomeSectionShell>
  );
}

export default React.memo(ReciterRailSection);
