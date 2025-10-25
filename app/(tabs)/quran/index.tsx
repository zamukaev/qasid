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
      const response = await axiosInstance.get("/resources/chapter_reciters");
      console.log(response.data);
      setReciters(
        response.data.reciters.map((reciter: Reciter) => ({
          ...reciter,
          photo_url: "",
          arabic_name: "إبراهيم الأخضر",
        }))
      );
    } catch (error) {
      setError(error as string);
      console.error(error, "error hier");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchQuran();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView>
        <View className="flex-1 gap-3">
          {reciters.map((reciter) => (
            <ReciterCard
              key={reciter.id}
              reciter={reciter}
              onPress={(event) => console.log(event)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
