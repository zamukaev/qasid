import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { axiosInstance } from "../../../services/api-service";
import { Chapter, Reciter } from "../../../types/quran";
import { ReciterCard } from "../../../components";

export default function Quran() {
  const [reciters, setReciters] = useState<Reciter[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  //test api
  const fetchQuran = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/reciters?language=eng");

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

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView>
        <View className="flex-1 gap-3">
          {reciters.map((reciter) => (
            <ReciterCard key={reciter.id} reciter={reciter} href={reciter.id} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
