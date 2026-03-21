import { View, Text, FlatList } from "react-native";
import { FeaturedItem } from "../types/featured";
import FeaturedCard from "./FeaturedCard";
import FeaturedCardSkeleton from "./FeaturedCardSkeleton";
import { useRouter } from "expo-router";

interface FeaturedListProps {
  featuredItems: FeaturedItem[];
}

const FeaturedList = ({ featuredItems }: FeaturedListProps) => {
  const router = useRouter();

  return (
    <View className="flex-1 px-4 py-6">
      <View className="mb-5">
        <Text className="mt-1 text-qasid-white text-2xl font-bold">
          Featured
        </Text>
      </View>

      <FlatList
        data={featuredItems}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingRight: 20,
        }}
        keyExtractor={(item, index) =>
          item ? item.id.toString() : `featured-skeleton-${index}`
        }
        renderItem={({ item }) =>
          item === null ? (
            <FeaturedCardSkeleton className="mr-4" />
          ) : (
            <FeaturedCard
              title={item.title_en}
              subtitle={item.title_ar}
              imageUrl={item.image_path}
              playing={false}
              className="mr-4"
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
    </View>
  );
};

export default FeaturedList;
