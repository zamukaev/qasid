import { useEffect, useState, useRef } from "react";
import { Text, View, Pressable, FlatList } from "react-native";
import { FirebaseReciter, ResponseReciters } from "../../../types/quran";
import { Image } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
  Search,
  ShowError,
  ReciterGridCardSkeleton,
} from "../../../components";
import {
  fetchFilteredReciters,
  fetchNewReciters,
  fetchPopularReciters,
  fetchReciters,
} from "../../../services/quran-service";
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
  const POPULAR_PAGE_SIZE = 1000;
  const router = useRouter();
  const navigation = useNavigation();
  const { sort } = useLocalSearchParams<{ sort?: string }>();
  const isPopularMode = sort === "popular";
  const isNewMode = sort === "new";
  const [reciters, setReciters] = useState<FirebaseReciter[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] =
    useState<ResponseReciters["nextCursor"]>();
  const [hasMore, setHasMore] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const latestSearchRef = useRef("");
  const hasInitializedRef = useRef(false);
  const skippedInitialSearchRef = useRef(false);
  const screenTitle = isPopularMode
    ? "Popular Reciters"
    : isNewMode
      ? "New Reciters"
      : "All Reciters";

  useEffect(() => {
    navigation.setOptions({
      title: screenTitle,
    });
  }, [navigation, screenTitle]);

  const loadReciters = async (loadMore = false, query = "") => {
    const trimmedQuery = query.trim();
    const isSearchMode = trimmedQuery.length > 0;
    const isInitialLoad = !loadMore && reciters.length === 0 && !isSearchMode;

    if (loadMore) {
      if (isPopularMode) {
        return;
      }
      if (loading || loadingMore || !hasMore || !nextCursor) {
        return;
      }
      setLoadingMore(true);
    } else {
      if (loading && !isSearchMode) {
        return;
      }
      if (isSearchMode) {
        setIsSearching(true);
      } else if (isInitialLoad) {
        setLoading(true);
      }
    }

    try {
      let responseReciters: FirebaseReciter[] = [];
      let responseNextCursor: ResponseReciters["nextCursor"];

      if (isPopularMode && !isSearchMode) {
        responseReciters = await fetchPopularReciters(POPULAR_PAGE_SIZE);
        responseNextCursor = undefined;
      } else if (isNewMode && !isSearchMode) {
        const response = await fetchNewReciters(PAGE_SIZE, loadMore ? nextCursor : undefined);
        responseReciters = response.reciters;
        responseNextCursor = response.nextCursor;
      } else if (isSearchMode) {
        const response = await fetchFilteredReciters(
          trimmedQuery,
          PAGE_SIZE,
          loadMore ? nextCursor : undefined,
        );
        responseReciters = response.reciters;
        responseNextCursor = response.nextCursor;
      } else {
        const response = await fetchReciters(
          PAGE_SIZE,
          loadMore ? nextCursor : undefined,
        );
        responseReciters = response.reciters;
        responseNextCursor = response.nextCursor;
      }

      if (latestSearchRef.current !== trimmedQuery) {
        return;
      }

      setReciters((prev) => {
        if (!loadMore) {
          return responseReciters;
        }

        const existingIds = new Set(prev.map((item) => item.id));
        const newItems = responseReciters.filter(
          (item) => !existingIds.has(item.id),
        );
        return [...prev, ...newItems];
      });

      setNextCursor(responseNextCursor);
      setHasMore(Boolean(responseNextCursor));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      console.error("Error loading reciters ", e);
    } finally {
      if (loadMore) {
        setLoadingMore(false);
      } else {
        setIsSearching(false);
        if (isInitialLoad) {
          setLoading(false);
        }
      }
    }
  };

  useEffect(() => {
    latestSearchRef.current = "";
    loadReciters(false, "");
    hasInitializedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      return;
    }

    if (!skippedInitialSearchRef.current) {
      skippedInitialSearchRef.current = true;
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      const trimmedQuery = searchQuery.trim();
      latestSearchRef.current = trimmedQuery;
      setHasMore(true);
      setNextCursor(undefined);
      loadReciters(false, trimmedQuery);
    }, 500);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  if (error) {
    return <ShowError message={error} />;
  }

  const listData: (FirebaseReciter | number)[] =
    loading || isSearching
      ? Array.from({ length: 18 }, (_, index) => index)
      : reciters;

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
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4 items-center">
              <Text className="text-qasid-gold text-sm">Loading more...</Text>
            </View>
          ) : !loading && reciters.length === 0 ? (
            <View className="py-8 items-center">
              <Text className="text-qasid-white/70 text-sm">
                {searchQuery.trim()
                  ? "No reciters found for this search."
                  : isPopularMode
                    ? "No popular reciters available right now."
                    : isNewMode
                      ? "No new reciters available right now."
                    : "No reciters available right now."}
              </Text>
            </View>
          ) : null
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (isPopularMode) {
            return;
          }
          loadReciters(true, latestSearchRef.current);
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
