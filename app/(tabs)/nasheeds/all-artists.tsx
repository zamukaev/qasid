import { useEffect, useRef, useState } from "react";
import { Text, View, FlatList } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
  Search,
  ShowError,
  ReciterGridCardSkeleton,
} from "../../../components";
import { NasheedArtist, ResponseArtists } from "../../../types/nasheed";

import {
  fetchNasheedArtists,
  fetchFilteredArtists,
  fetchPopularArtists,
  fetchNewArtists,
} from "../../../services/nasheeds-service";
import ArtistCard from "../../../components/ArtistCard";

export default function AllArtists() {
  const PAGE_SIZE = 24;
  const router = useRouter();
  const navigation = useNavigation();
  const { sort } = useLocalSearchParams<{ sort?: string }>();
  const isPopularMode = sort === "popular";
  const isNewMode = sort === "new";

  const [artists, setArtists] = useState<NasheedArtist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<ResponseArtists["nextCursor"]>();
  const [hasMore, setHasMore] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const latestSearchRef = useRef("");
  const hasInitializedRef = useRef(false);
  const skippedInitialSearchRef = useRef(false);

  const screenTitle = isPopularMode
    ? "Popular Artists"
    : isNewMode
      ? "New Artists"
      : "All Artists";

  useEffect(() => {
    navigation.setOptions({ title: screenTitle });
  }, [navigation, screenTitle]);

  const loadArtists = async (loadMore = false, query = "") => {
    const trimmedQuery = query.trim();
    const isSearchMode = trimmedQuery.length > 0;
    const isInitialLoad = !loadMore && artists.length === 0 && !isSearchMode;

    if (loadMore) {
      if (isPopularMode || isNewMode) return;
      if (loading || loadingMore || !hasMore || !nextCursor) return;
      setLoadingMore(true);
    } else {
      if (loading && !isSearchMode) return;
      if (isSearchMode) {
        setIsSearching(true);
      } else if (isInitialLoad) {
        setLoading(true);
      }
    }

    try {
      let responseArtists: NasheedArtist[] = [];
      let responseNextCursor: ResponseArtists["nextCursor"];

      if (isPopularMode && !isSearchMode) {
        responseArtists = await fetchPopularArtists(1000);
        responseNextCursor = undefined;
      } else if (isNewMode && !isSearchMode) {
        responseArtists = await fetchNewArtists(1000);
        responseNextCursor = undefined;
      } else if (isSearchMode) {
        const response = await fetchFilteredArtists(
          trimmedQuery,
          PAGE_SIZE,
          loadMore ? nextCursor : undefined,
        );
        responseArtists = response.artists;
        responseNextCursor = response.nextCursor;
      } else {
        const response = await fetchNasheedArtists(
          PAGE_SIZE,
          loadMore ? nextCursor : undefined,
        );
        responseArtists = response.artists;
        responseNextCursor = response.nextCursor;
      }

      if (latestSearchRef.current !== trimmedQuery) return;

      setArtists((prev) => {
        if (!loadMore) return responseArtists;
        const existingIds = new Set(prev.map((item) => item.id));
        return [
          ...prev,
          ...responseArtists.filter((item) => !existingIds.has(item.id)),
        ];
      });

      setNextCursor(responseNextCursor);
      setHasMore(Boolean(responseNextCursor));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      console.error("Error loading artists:", e);
    } finally {
      if (loadMore) {
        setLoadingMore(false);
      } else {
        setIsSearching(false);
        if (isInitialLoad) setLoading(false);
      }
    }
  };

  useEffect(() => {
    latestSearchRef.current = "";
    loadArtists(false, "");
    hasInitializedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasInitializedRef.current) return;
    if (!skippedInitialSearchRef.current) {
      skippedInitialSearchRef.current = true;
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      const trimmedQuery = searchQuery.trim();
      latestSearchRef.current = trimmedQuery;
      setHasMore(true);
      setNextCursor(undefined);
      loadArtists(false, trimmedQuery);
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery]);

  if (error) {
    return <ShowError message={error} />;
  }

  const listData: (NasheedArtist | number)[] =
    loading || isSearching ? Array.from({ length: 18 }, (_, i) => i) : artists;

  return (
    <View className="flex-1 bg-qasid-black">
      <Search searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <FlatList
        data={listData}
        keyExtractor={(item, index) =>
          loading || typeof item === "number" ? `skeleton-${index}` : item.id
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
          ) : !loading && artists.length === 0 ? (
            <View className="py-8 items-center">
              <Text className="text-qasid-white/70 text-sm">
                {searchQuery.trim()
                  ? "No artists found for this search."
                  : isPopularMode
                    ? "No popular artists available right now."
                    : isNewMode
                      ? "No new artists available right now."
                      : "No artists available right now."}
              </Text>
            </View>
          ) : null
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (isPopularMode || isNewMode) return;
          loadArtists(true, latestSearchRef.current);
        }}
        renderItem={({ item }) => {
          if (loading || isSearching || typeof item === "number") {
            return <ReciterGridCardSkeleton />;
          }
          return (
            <ArtistCard
              artist={item as NasheedArtist}
              onPress={(id) =>
                router.push({
                  pathname: "/(tabs)/nasheeds/artist/[id]",
                  params: { id },
                })
              }
            />
          );
        }}
      />
    </View>
  );
}
