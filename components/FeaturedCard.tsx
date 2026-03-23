import { View, Text, Image, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import PlaceholderAvatar from "../assets/images/avatar.webp";
interface Props {
  title: string;
  subtitle?: string;
  imageUrl: string;
  onPress?: () => void;
  playing?: boolean;
  className?: string;
}
export default function FeaturedCard({
  title,
  subtitle,
  imageUrl,
  onPress,
  className = "",
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      className={`overflow-hidden rounded-[28px] border border-white/10 bg-qasid-card ${className}`}
      android_ripple={{ color: "#E7C11C33" }}
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.94 : 1,
          transform: [{ scale: pressed ? 0.988 : 1 }],
          shadowColor: "#E7C11C",
          shadowOpacity: pressed ? 0.16 : 0.1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        },
      ]}
    >
      <LinearGradient
        colors={["#1B1B1C", "#0B0B0C", "rgba(231,193,28,0.14)"]}
        start={{ x: 0.2, y: 0.0 }}
        end={{ x: 1, y: 1 }}
      >
        <View className="absolute inset-0 rounded-[28px] border border-qasid-gold/8" />
        <View className="p-5 h-80 w-60">
          <View className="items-center">
            <View className="w-40 h-40 rounded-full overflow-hidden border border-qasid-gold/20 shadow-black/25">
              <Image
                source={imageUrl ? { uri: imageUrl } : PlaceholderAvatar}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
          </View>

          <View className="mt-auto">
            <View className="h-24 rounded-2xl border border-white/8 bg-black/35 px-4 py-4">
              <View className="flex-1 items-center justify-center gap-1">
                <Text className="text-qasid-title text-xs">{subtitle}</Text>
                <Text className="text-white text-l">{title}</Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
