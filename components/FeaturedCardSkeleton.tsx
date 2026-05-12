import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  className?: string;
};

export default function FeaturedCardSkeleton({ className = "" }: Props) {
  return (
    <View className={`overflow-hidden rounded-[28px] border border-white/10 ${className}`}>
      <LinearGradient
        colors={["#1B1B1C", "#0B0B0C", "rgba(231,193,28,0.12)"]}
        start={{ x: 0.2, y: 0.0 }}
        end={{ x: 1, y: 1 }}
      >
        <View className="w-60 h-80 p-5">
          <View className="items-center">
            <View
              className="h-40 w-40 rounded-full overflow-hidden border border-qasid-gold/20 bg-gray-700/30 animate-pulse"
              style={{
                shadowColor: "#E7C11C",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.18,
                shadowRadius: 8,
                elevation: 4,
              }}
            />
          </View>

          <View className="mt-auto">
            <View className="rounded-2xl border border-white/8 bg-black/30 px-4 py-4">
              <View className="flex-1 justify-center">
                <View className="h-3 w-20 rounded bg-gray-700/25 animate-pulse mb-2" />
                <View className="h-5 w-40 rounded bg-gray-700/30 animate-pulse" />
                <View className="h-3 w-24 rounded bg-gray-700/20 animate-pulse mt-4" />
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
