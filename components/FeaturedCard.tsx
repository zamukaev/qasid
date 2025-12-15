import { View, Text, Image, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
type Props = {
  title: string; // z.B. "Ghassan Al Shorbagy"
  subtitle?: string; // default: "Editor’s Pick"
  imageUrl: string; // runder Avatar
  onPress?: () => void; // gesamter Card-Press
  playing?: boolean; // steuert Icon (Play/Pause)
  className?: string; // optional für zusätzliche Styles
};
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
      className={`overflow-hidden rounded-3xl ${className}`}
      android_ripple={{ color: "#E7C11C33" }}
    >
      {/* Background Gradient (Dark -> soft Gold haze) */}
      <LinearGradient
        colors={["#0B0B0C", "#141416", "rgba(231,193,28,0.10)"]}
        start={{ x: 0.1, y: 0.0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-3xl"
      >
        {/* Content Layer */}
        <View className="p-5 h-80 w-72">
          {/* Avatar */}
          <View className="items-center">
            <View className="w-40 h-40 rounded-full overflow-hidden border border-qasid-gold-20">
              <Image
                source={{ uri: imageUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Bottom Glass Panel */}
          <View className="mt-auto">
            <View className="h-28 flex-row items-start justify-between rounded-2xl bg-qasid-card px-5 py-4 border border-white/5">
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
              <View className="ml-4 w-10 h-10 rounded-full self-center items-center justify-center border border-qasid-gold">
                <Ionicons
                  name={playing ? "pause" : "play"}
                  size={14}
                  color="#E7C11C"
                />
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
