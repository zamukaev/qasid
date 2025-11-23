import { useEffect, useState, useRef } from "react";
import { ScrollView, Text, View, TextInput, Pressable } from "react-native";
import { axiosInstance } from "../../../services/api-service";
import { Reciter } from "../../../types/quran";
import MisharyForo from "../../../assets/reciters/mishary-rashid.jpg";
import { Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

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

      const sortedReciters = response.data.reciters
        .sort((a: Reciter, b: Reciter) => {
          if (a.letter < b.letter) return -1;
          if (a.letter > b.letter) return 1;
          return 0;
        })
        .map((reciter: Reciter) => ({
          ...reciter,
          photo_url: "",
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
    return (
      <View className="flex-1 items-center justify-center bg-qasid-black">
        <Text className="text-qasid-gold text-lg mb-2">{error}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-qasid-black">
        <View className="flex-1 justify-center items-center">
          <Text className="text-qasid-gold text-lg mb-2">
            Loading reciters...
          </Text>
          <View
            style={{
              width: 40,
              height: 40,
              borderWidth: 4,
              borderColor: "#E7C11C44",
              borderTopColor: "#E7C11C",
              borderRadius: 20,
              marginTop: 8,
            }}
            className="animate-spin"
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-qasid-black">
      {/* Search Bar - Fixed in header area */}
      <View className="px-4 py-3 bg-qasid-black border-b border-qasid-gray/30">
        <View className="flex-row items-center bg-qasid-gray/50 rounded-xl px-4 py-3">
          <Ionicons
            name="search"
            size={20}
            color="#9CA3AF"
            style={{ marginRight: 8 }}
          />
          <TextInput
            className="flex-1 text-qasid-white text-base"
            placeholder="Reciter Name"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: 120, // Отступ для мини-плеера
        }}
      >
        {/* Searching indicator */}
        {isSearching && (
          <View className="px-4 py-2 items-center">
            <Text className="text-qasid-gold text-sm">Searching...</Text>
          </View>
        )}

        <View className="px-4 py-6">
          {/* Three-column grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {filteredReciters.map((reciter) => (
              <Pressable
                key={reciter.id}
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
                    source={MisharyForo}
                  />
                </View>
                <Text className="text-qasid-white text-center text-base">
                  {reciter.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
