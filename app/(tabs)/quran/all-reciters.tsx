import { useEffect, useState, useRef } from "react";
import { Text, View, Pressable, FlatList } from "react-native";
import { FirebaseReciter, ResponseReciters } from "../../../types/quran";
import { Image } from "react-native";
import { useRouter } from "expo-router";
import {
  Search,
  ShowError,
  ReciterGridCardSkeleton,
} from "../../../components";
import { fetchReciters } from "../../../services/quran-service";
import { useReciterImageSource } from "../../../hooks/useReciterImageSource";

interface ReciterGridItemProps {
  reciter: FirebaseReciter;
  onPress: (id: string | number) => void;
}

function ReciterGridItem({ reciter, onPress }: ReciterGridItemProps) {
  const imageSource = useReciterImageSource(reciter.image_path);

  return (
    <Pressable
      style={{
        width: "30%",
        alignItems: "center",
      }}
      onPress={() => onPress(reciter.id)}
    >
      <View
        className="rounded-full mb-3"
        style={{
          shadowColor: "#E7C11C",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Image
          className="h-32 w-32 rounded-full border-2 border-qasid-gold/25"
          source={imageSource}
        />
      </View>
      <Text className="text-qasid-white text-center text-base">
        {reciter.name_en}
      </Text>
    </Pressable>
  );
}

export default function AllReciters() {
  const PAGE_SIZE = 24;
  const router = useRouter();
  const [reciters, setReciters] = useState<FirebaseReciter[]>([]);
  const [filteredReciters, setFilteredReciters] = useState<FirebaseReciter[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<ResponseReciters["nextCursor"]>();
  const [hasMore, setHasMore] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const loadReciters = async (loadMore = false) => {
    if (loadMore) {
      if (loading || loadingMore || !hasMore || !nextCursor) {
        return;
      }
      setLoadingMore(true);
    } else {
      if (loading) {
        return;
      }
      setLoading(true);
    }

    try {
      const response = await fetchReciters(
        PAGE_SIZE,
        loadMore ? nextCursor : undefined,
      );

      setReciters((prev) => {
        if (!loadMore) {
          return response.reciters;
        }

        const existingIds = new Set(prev.map((item) => item.id));
        const newItems = response.reciters.filter((item) => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });

      setNextCursor(response.nextCursor);
      setHasMore(Boolean(response.nextCursor) && response.reciters.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      console.error("Error loading reciters ", e);
    } finally {
      if (loadMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadReciters(false);
  }, []);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Show searching indicator
    if (searchQuery.trim() !== "") {
      setIsSearching(true);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      setIsSearching(false);
      if (searchQuery.trim() === "") {
        setFilteredReciters(reciters);
      } else {
        const filtered = reciters.filter(
          (reciter) =>
            reciter.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
            reciter.name_ar.toLowerCase().includes(searchQuery.toLowerCase()),
        );
        setFilteredReciters(filtered);
      }
    }, 500); // 500ms debounce

    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery, reciters]);

  if (error) {
    return <ShowError message={error} />;
  }

  const listData: (FirebaseReciter | number)[] = loading
    ? Array.from({ length: 18 }, (_, index) => index)
    : filteredReciters;

  return (
    <View className="flex-1 bg-qasid-black">
      <Search searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <FlatList
        data={listData}
        keyExtractor={(item, index) =>
          loading || typeof item === "number"
            ? `skeleton-${index}`
            : item.id.toString()
        }
        numColumns={3}
        contentContainerStyle={{
          paddingBottom: 120,
          paddingHorizontal: 16,
          paddingTop: 24,
          gap: 16,
        }}
        columnWrapperStyle={{ gap: 16 }}
        ListHeaderComponent={
          isSearching ? (
            <View className="px-4 py-2 items-center">
              <Text className="text-qasid-gold text-sm">Searching...</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4 items-center">
              <Text className="text-qasid-gold text-sm">Loading more...</Text>
            </View>
          ) : null
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          loadReciters(true);
        }}
        renderItem={({ item }: { item: FirebaseReciter | number }) => {
          if (loading || typeof item === "number") {
            return <ReciterGridCardSkeleton />;
          }

          return (
            <ReciterGridItem
              reciter={item as FirebaseReciter}
              onPress={(id) =>
                router.push({
                  pathname: "/(tabs)/quran/reciter/[id]",
                  params: { id: id.toString() },
                })
              }
            />
          );
        }}
      />
    </View>
  );
}
