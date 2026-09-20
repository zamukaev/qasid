import React, { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import HomeSectionShell from "./HomeSectionShell";

interface HorizontalRailSectionProps<T> {
  title: string;
  description?: string;
  items: T[];
  isLoading?: boolean;
  onPressSeeAll?: () => void;
  skeletonCount?: number;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  renderSkeleton: (index: number) => ReactNode;
}

function HorizontalRailSection<T>({
  title,
  description,
  items,
  isLoading = false,
  onPressSeeAll,
  skeletonCount = 8,
  keyExtractor,
  renderItem,
  renderSkeleton,
}: HorizontalRailSectionProps<T>) {
  if (!isLoading && items.length === 0) return null;

  return (
    <HomeSectionShell title={title} onPressSeeAll={onPressSeeAll}>
      {!!description && (
        <Text className="mb-5 -mt-1 text-white/45 text-sm">{description}</Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4"
        contentContainerStyle={{ paddingLeft: 16, paddingRight: 0 }}
      >
        <View className="flex-row">
          {isLoading
            ? Array.from({ length: skeletonCount }, (_, i) => (
                <View key={`${title}-skeleton-${i}`} className="mr-3">
                  {renderSkeleton(i)}
                </View>
              ))
            : items.map((item) => (
                <View key={keyExtractor(item)} className="mr-3">
                  {renderItem(item)}
                </View>
              ))}
        </View>
      </ScrollView>
    </HomeSectionShell>
  );
}

export default HorizontalRailSection;
