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
  playing = false,
  className = "",
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      className={`overflow-hidden rounded-2xl ${className}`}
      android_ripple={{ color: "#E7C11C33" }}
    >
      {/* Background Gradient (Dark -> soft Gold haze) */}
      <LinearGradient
        colors={["#1C1C1C", "#0B0B0C", "rgba(231,193,28,0.10)"]}
        start={{ x: 0.2, y: 0.0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-1xl"
      >
        {/* Content Layer */}
        <View className="p-5 h-80 w-60">
          {/* Avatar */}
          <View className="items-center">
            <View className="w-40 h-40 rounded-full overflow-hidden border border-qasid-gold-20">
              <Image
                source={imageUrl ? { uri: imageUrl } : PlaceholderAvatar}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Bottom Glass Panel */}
          <View className="mt-auto">
            <View className="h-28 flex-row items-start justify-between  bg-qasid-card py-4">
              <View className="flex-1">
                <Text
                  className="text-qasid-gold/70 text-x tracking-wide"
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
                <Text
                  className="text-white text-xl  font-semibold mt-0.5"
                  numberOfLines={2}
                >
                  {title}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
