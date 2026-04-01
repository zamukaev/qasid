import { Pressable, Text, View, Image } from "react-native";

import { FirebaseReciter } from "../types/quran";
import { useRouter } from "expo-router";
import { useReciterImageSource } from "../hooks/useReciterImageSource";

interface ReciterCardProps {
  reciter: FirebaseReciter;
}

const getReciterDisplayName = (reciter: FirebaseReciter) =>
  reciter.name_en?.trim() || reciter.name_ar?.trim() || "Unknown reciter";

export default function ReciterCard({ reciter }: ReciterCardProps) {
  const router = useRouter();
  const imageSource = useReciterImageSource(reciter.image_path);
  const displayName = getReciterDisplayName(reciter);
  const handlePress = () => {
    router.push({
      pathname: "/(tabs)/quran/reciter/[id]",
      params: { id: reciter.id.toString() },
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row  items-center justify-between rounded-2xl  border border-qasid-gold/25 p-4"
      android_ripple={{ color: "#E7C11C20" }}
    >
      <View
        className="rounded-full mr-6"
        style={{
          shadowColor: "#E7C11C",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        {imageSource ? (
          <Image
            className="h-16 w-16 rounded-full  border border-qasid-gold/25 "
            source={imageSource}
          />
        ) : (
          <View className="flex-1 border bg-qasid-gray border-qasid-gold/25 items-center justify-center h-16 w-16 rounded-full">
            <Text className="text-qasid-gold font-semibold text-3xl">
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-qasid-white font-semibold text-lg">
          {displayName}
        </Text>
        <Text className="text-qasid-gold font-light text-base opacity-[0.8]">
          {reciter.name_ar}
        </Text>
      </View>
    </Pressable>
  );
}

interface CompactReciterCardProps {
  reciter: FirebaseReciter;
}

export function CompactReciterCard({ reciter }: CompactReciterCardProps) {
  const router = useRouter();
  const imageSource = useReciterImageSource(reciter.image_path);
  const displayName = getReciterDisplayName(reciter);
  const handlePress = () => {
    router.push({
      pathname: "/(tabs)/quran/reciter/[id]",
      params: { id: reciter.id.toString() },
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      className="items-center"
      style={{ width: 100 }}
    >
      <View
        className="rounded-full mb-2"
        style={{
          shadowColor: "#E7C11C",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Image
          className="h-20 w-20 rounded-full border-2 border-qasid-gold/25"
          source={imageSource}
        />
      </View>
      <Text
        className="text-qasid-white text-center text-sm leading-4"
        numberOfLines={2}
      >
        {displayName}
      </Text>
    </Pressable>
  );
}
