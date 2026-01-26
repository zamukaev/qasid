import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, View, Pressable } from "react-native";
import { axiosInstance } from "../../../services/api-service";
import { Reciter } from "../../../types/quran";
import {
  CompactReciterCard,
  CompactReciterCardSkeleton,
  FeaturedList,
  Loader,
  ShowError,
} from "../../../components";
import { useRouter } from "expo-router";

import {
  loadFeaturedItems,
  loadRecitersImages,
} from "../../../services/featured-service";
import { FeaturedItem } from "../../../types/featured";

export default function Quran() {
  const router = useRouter();
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeaturedItems = async () => {
    try {
      const data = await loadFeaturedItems();
      setFeaturedItems(data);
    } catch (e) {
      console.error("Error loading featured items ", e);
    } finally {
    }
  };

  const fetchQuran = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(
        "/reciters?language=eng&limit=20",
      );
      const imagesResponse = await loadRecitersImages();

      setReciters(
        response.data.reciters
          .sort((a: Reciter, b: Reciter) => {
            if (a.letter < b.letter) return -1;
            if (a.letter > b.letter) return 1;
            return 0;
          })
          .map((reciter: Reciter) => ({
            ...reciter,
            image_path:
              imagesResponse.find((img) => img.id === reciter.id)?.image_path ??
              "",
          })),
      );
      setLoading(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuran();
    fetchFeaturedItems();
  }, []);

  if (error) {
    return <ShowError message={error} />;
  }

  // Calculate the total width needed for all cards
  const displayReciters = loading ? Array.from({ length: 20 }) : reciters;
  const totalColumns = Math.ceil(displayReciters.length / 2);
  const cardWidth = 100;
  const cardGap = 0;
  const containerWidth = totalColumns * (cardWidth + cardGap);

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView>
        <FeaturedList featuredItems={featuredItems} />
        <View className="px-4 py-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-qasid-white text-2xl font-bold">
              All Reciters
            </Text>
            <Pressable onPress={() => router.push("quran/all-reciters")}>
              <Text className="text-qasid-title text-base font-semibold underline">
                See All
              </Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingRight: 20,
            }}
          >
            <View style={{ width: containerWidth, height: 300 }}>
              {loading
                ? displayReciters.map((_, index) => {
                    const row = index % 2;
                    const column = Math.floor(index / 2);
                    return (
                      <View
                        key={`skeleton-${index}`}
                        style={{
                          position: "absolute",
                          left: column * (cardWidth + cardGap),
                          top: row * 140,
                        }}
                      >
                        <CompactReciterCardSkeleton />
                      </View>
                    );
                  })
                : reciters.map((reciter, index) => {
                    const row = index % 2;
                    const column = Math.floor(index / 2);
                    return (
                      <View
                        key={reciter.id}
                        style={{
                          position: "absolute",
                          left: column * (cardWidth + cardGap),
                          top: row * 140,
                        }}
                      >
                        <CompactReciterCard reciter={reciter} />
                      </View>
                    );
                  })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
