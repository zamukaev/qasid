import React from "react";
import { useRouter } from "expo-router";

import { FeaturedItem } from "../types/featured";
import { CardVariantProps } from "./CompactRailCard";
import FeaturedCard, { FeaturedCardSkeleton } from "./FeaturedCard";
import HorizontalRailSection from "./HorizontalRailSection";

interface FeaturedListProps extends CardVariantProps {
  featuredItems: FeaturedItem[];
  isLoading?: boolean;
  title?: string;
  onPressSeeAll?: () => void;
}

function FeaturedList({
  featuredItems,
  isLoading = false,
  title = "Featured",
  onPressSeeAll,
  circle,
  large,
  small,
}: FeaturedListProps) {
  const router = useRouter();

  return (
    <HorizontalRailSection
      title={title}
      description="Curated recitations and collections"
      items={featuredItems}
      isLoading={isLoading}
      onPressSeeAll={onPressSeeAll}
      skeletonCount={5}
      keyExtractor={(item) => item.id.toString()}
      renderItem={(item) => (
        <FeaturedCard
          title={item.title_en}
          subtitle={item.title_ar}
          imageUrl={item.image_path}
          circle={circle}
          large={large}
          small={small}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/quran/reciter/[id]",
              params: {
                id: item.id.toString(),
                content_type: item.content_type,
                target: item.target,
              },
            })
          }
        />
      )}
      renderSkeleton={(_) => (
        <FeaturedCardSkeleton circle={circle} large={large} small={small} />
      )}
    />
  );
}

export default React.memo(FeaturedList);
