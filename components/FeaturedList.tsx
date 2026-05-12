import React from "react";
import { Text, FlatList } from "react-native";
import { useRouter } from "expo-router";

import { FeaturedItem } from "../types/featured";
import FeaturedCard from "./FeaturedCard";
import FeaturedCardSkeleton from "./FeaturedCardSkeleton";
import HomeSectionShell from "./HomeSectionShell";

interface FeaturedListProps {
  featuredItems: FeaturedItem[];
  isLoading?: boolean;
  title?: string;
  className?: string;
}

function FeaturedList({
  featuredItems,
  isLoading,
  title = "Featured",
  className = "",
}: FeaturedListProps) {
  const router = useRouter();

  return (
    <HomeSectionShell title={title} className={className}>
      <Text className="mb-5 -mt-1 text-white/45 text-sm">
        Curated recitations and collections
      </Text>

      <FlatList
        data={isLoading ? Array(5).fill(null) : featuredItems}
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4"
        contentContainerStyle={{
          paddingLeft: 16,
          paddingRight: 0,
        }}
        keyExtractor={(item, index) =>
          item ? item.id.toString() : `featured-skeleton-${index}`
        }
        renderItem={({ item }) =>
          isLoading ? (
            <FeaturedCardSkeleton className="mr-5" />
          ) : (
            <FeaturedCard
              title={item.title_en}
              subtitle={item.title_ar}
              imageUrl={item.image_path}
              playing={false}
              className="mr-5"
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
          )
        }
      />
    </HomeSectionShell>
  );
}

export default React.memo(FeaturedList);
