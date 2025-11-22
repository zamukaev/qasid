import { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  FlatList,
  Pressable,
} from "react-native";
import { axiosInstance } from "../../../services/api-service";
import { Reciter } from "../../../types/quran";
import { CompactReciterCard } from "../../../components";
import { useRouter } from "expo-router";
import FeaturedCard from "../../../components/FeaturedCard";

const FEATURED_LIST = [92, 123, 221, 107];

export default function Quran() {
  const router = useRouter();
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [featuredItems, setFeaturedItems] = useState<Reciter[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  //test api
  const fetchQuran = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/reciters?language=eng");
      setFeaturedItems(() =>
        response.data.reciters.filter((reciter: Reciter) =>
          FEATURED_LIST.includes(reciter.id)
        )
      );
      setReciters(
        response.data.reciters
          .sort((a: Reciter, b: Reciter) => {
            if (a.letter < b.letter) return -1;
            if (a.letter > b.letter) return 1;
            return 0;
          })
          .map((reciter: Reciter) => ({
            ...reciter,
            photo_url: "",
          }))
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
  }, []);

  if (error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-qasid-black">
        <Text className="text-qasid-gold text-lg mb-2">{error}</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-qasid-black">
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
      </SafeAreaView>
    );
  }

  // Calculate the total width needed for all cards
  const totalColumns = Math.ceil(reciters.length / 2);
  const cardWidth = 100;
  const cardGap = 0;
  const containerWidth = totalColumns * (cardWidth + cardGap);

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView>
        {/* Featured Section */}
        <View className="flex-1 px-4 py-6">
          <Text className="text-white text-3xl font-bold mb-8">Featured</Text>
          <FlatList
            data={featuredItems}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(reciter) => reciter.id.toString()}
            renderItem={({ item }) => (
              <FeaturedCard
                title={item.name}
                subtitle="Editor's Pick"
                imageUrl={require(`../../../assets/reciters/99.jpg`)}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/quran/reciter/[id]",
                    params: { id: item.id.toString() },
                  })
                }
                playing={false}
                className="mb-4 mr-4"
                key={item.id}
              />
            )}
          />
        </View>

        {/* All Reciters Section */}
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

          {/* Scrollable two-row grid */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingRight: 20,
            }}
          >
            <View style={{ width: containerWidth, height: 300 }}>
              {reciters.map((reciter, index) => {
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
