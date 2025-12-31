import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function SurahDetail() {
  const { id } = useLocalSearchParams();

  return (
    <View className="flex-1 justify-center items-center bg-[#090A07]">
      <Text className="text-white">Surah ID: {id}</Text>
    </View>
  );
}
