import { useEffect, useState, useRef } from "react";
import { Text, View, Pressable, FlatList } from "react-native";
import { axiosInstance } from "../../../services/api-service";
import { Reciter } from "../../../types/quran";
import { Image } from "react-native";
import { useRouter } from "expo-router";
import { loadRecitersImages } from "../../../services/featured-service";
import { Loader, Search, ShowError } from "../../../components";
import PlaceholderAvatar from "../../../assets/images/avatar.webp";

export default function AllReciters() {
  const router = useRouter();
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [filteredReciters, setFilteredReciters] = useState<Reciter[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchReciters = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/reciters?language=eng");
      const imagesResponse = await loadRecitersImages();
      console.log("Reciters response:", response.data.reciters);
      const sortedReciters = response.data.reciters
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
        }));

      setReciters(sortedReciters);
      setFilteredReciters(sortedReciters);
      setLoading(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReciters();
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
        const filtered = reciters.filter((reciter) =>
          reciter.name.toLowerCase().includes(searchQuery.toLowerCase())
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

  if (loading) {
    return <Loader message=" Loading reciters..." />;
  }

  return (
    <View className="flex-1 bg-qasid-black">
      <Search searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <FlatList
        data={filteredReciters}
        keyExtractor={(item) => item.id.toString()}
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
        renderItem={({ item: reciter }) => (
          <Pressable
            style={{
              width: "30%",
              alignItems: "center",
            }}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/quran/reciter/[id]",
                params: { id: reciter.id.toString() },
              })
            }
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
                source={
                  reciter.image_path
                    ? { uri: reciter.image_path }
                    : PlaceholderAvatar
                }
              />
            </View>
            <Text className="text-qasid-white text-center text-base">
              {reciter.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
