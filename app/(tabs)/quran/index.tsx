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
import {
  fetchNewReciters,
  fetchPopularReciters,
  fetchReciters,
} from "../../../services/quran-service";
import { FontAwesome6 } from "@expo/vector-icons";

export default function Quran() {
  const router = useRouter();
  const [reciters, setReciters] = useState<FirebaseReciter[]>([]);
  const [popularReciters, setPopularReciters] = useState<FirebaseReciter[]>([]);
  const [newReciters, setNewReciters] = useState<FirebaseReciter[]>([]);
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
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
      const [response, popular] = await Promise.all([
        fetchReciters(),
        fetchPopularReciters(),
      ]);
      setReciters(response.reciters);
      setPopularReciters(popular);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      console.error("Error loading reciters ", e);
    } finally {
      setLoading(false);
    }
  };

  const loadNewReciters = async () => {
    try {
      setLoadingNew(true);
      const response = await fetchNewReciters(8);
      setNewReciters(response.reciters);
    } catch (e) {
      console.error("Error loading new reciters ", e);
    } finally {
      setLoadingNew(false);
    }
  };

  useEffect(() => {
    loadReciters();
    loadNewReciters();
    fetchFeaturedItems();
  }, []);

  if (error) {
    return <ShowError message={error} />;
  }

  // Use two rows only when there are more than six items.
  const displayReciters = loading ? Array.from({ length: 20 }) : reciters;
  const displayPopularReciters: Array<FirebaseReciter | null> = loading
    ? Array.from({ length: 8 }, () => null)
    : popularReciters;
  const displayNewReciters: Array<FirebaseReciter | null> = loadingNew
    ? Array.from({ length: 8 }, () => null)
    : newReciters;
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
        <View className="px-4 pt-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-qasid-white text-2xl font-bold">
              Popular Reciters
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/quran/all-reciters",
                  params: { sort: "popular" },
                })
              }
            >
              <FontAwesome6 name="angle-right" size={14} color="#E7C11C" />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingRight: 20,
            }}
          >
            <View className="flex-row">
              {displayPopularReciters.map((reciter, index) => (
                <View
                  key={reciter?.id ?? `popular-skeleton-${index}`}
                  className="mr-3"
                >
                  {!reciter ? (
                    <CompactReciterCardSkeleton />
                  ) : (
                    <CompactReciterCard reciter={reciter} />
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
        {(loadingNew || newReciters.length > 0) && (
          <View className="px-4 py-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-qasid-white text-2xl font-bold">
                New Reciters
              </Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/quran/all-reciters",
                    params: { sort: "new" },
                  })
                }
              >
                <FontAwesome6 name="angle-right" size={14} color="#E7C11C" />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingRight: 20,
              }}
            >
              <View className="flex-row">
                {displayNewReciters.map((reciter, index) => (
                  <View
                    key={reciter?.id ?? `new-skeleton-${index}`}
                    className="mr-3"
                  >
                    {!reciter ? (
                      <CompactReciterCardSkeleton />
                    ) : (
                      <CompactReciterCard reciter={reciter} />
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
        <View className="px-4 py-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-qasid-white text-2xl font-bold">
              All Reciters
            </Text>
            <Pressable onPress={() => router.push("quran/all-reciters")}>
              <FontAwesome6 name="angle-right" size={14} color="#E7C11C" />
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
