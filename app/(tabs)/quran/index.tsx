import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, View, Pressable } from "react-native";
import { FirebaseReciter } from "../../../types/quran";
import {
  CompactReciterCard,
  CompactReciterCardSkeleton,
  FeaturedList,
  ShowError,
} from "../../../components";
import { useRouter } from "expo-router";

import { loadFeaturedItems } from "../../../services/featured-service";
import { FeaturedItem } from "../../../types/featured";
import { fetchReciters } from "../../../services/quran-service";

export default function Quran() {
  const router = useRouter();
  const [reciters, setReciters] = useState<FirebaseReciter[]>([]);
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

  const loadReciters = async () => {
    try {
      setLoading(true);
      const response = await fetchReciters();
      setReciters(response.reciters);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      console.error("Error loading reciters ", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReciters();
    fetchFeaturedItems();
  }, []);

  if (error) {
    return <ShowError message={error} />;
  }

  // Use two rows only when there are more than six items.
  const displayReciters = loading ? Array.from({ length: 20 }) : reciters;
  const useTwoRows = loading || reciters.length > 6;
  const rows = useTwoRows ? 2 : 1;
  const totalColumns = Math.ceil(displayReciters.length / rows);
  const cardWidth = 100;
  const cardGap = 0;
  const rowHeight = 140;
  const containerWidth = totalColumns * (cardWidth + cardGap);
  const containerHeight = rows * rowHeight;

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
            <View style={{ width: containerWidth, height: containerHeight }}>
              {loading
                ? displayReciters.map((_, index) => {
                    const row = index % rows;
                    const column = Math.floor(index / rows);
                    return (
                      <View
                        key={`skeleton-${index}`}
                        style={{
                          position: "absolute",
                          left: column * (cardWidth + cardGap),
                          top: row * rowHeight,
                        }}
                      >
                        <CompactReciterCardSkeleton />
                      </View>
                    );
                  })
                : reciters.map((reciter, index) => {
                    const row = index % rows;
                    const column = Math.floor(index / rows);
                    return (
                      <View
                        key={reciter.id}
                        style={{
                          position: "absolute",
                          left: column * (cardWidth + cardGap),
                          top: row * rowHeight,
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
