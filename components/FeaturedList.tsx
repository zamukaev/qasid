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

  if (featuredItems.length > 0) {
    return (
      <View className="flex-1 px-4 py-6">
        <Text className="text-white text-3xl font-bold mb-8">Featured</Text>
        <FlatList
          data={featuredItems}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(reciter) => reciter.id.toString()}
          renderItem={({ item }) => (
            <FeaturedCard
              title={item.title_en}
              subtitle={item.title_ar}
              imageUrl={item.image_path}
              playing={false}
              className="mb-4 mr-4"
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
        />
      </View>
    );
  }

  return (
    <View className="flex-1 px-4 py-6">
      <Text className="text-white text-3xl font-bold mb-8">Featured</Text>
      <FlatList
        data={[1, 2, 3]}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, index) => index.toString()}
        renderItem={() => <FeaturedCardSkeleton className="mb-4 mr-4" />}
      />
    </View>
  );
};

export default FeaturedList;
