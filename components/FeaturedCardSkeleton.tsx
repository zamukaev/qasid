import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  className?: string;
};

export default function FeaturedCardSkeleton({ className = "" }: Props) {
  return (
    <View className={`overflow-hidden rounded-3xl ${className}`}>
      <LinearGradient
        colors={["#0B0B0C", "#141416", "rgba(231,193,28,0.10)"]}
        start={{ x: 0.1, y: 0.0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-3xl"
      >
        {/* Content Layer */}
        <View className="p-5 h-80 w-72">
          {/* Avatar Skeleton */}
          <View className="items-center">
            <View className="w-40 h-40 rounded-full overflow-hidden border border-qasid-gold-20 bg-gray-700/30 animate-pulse" />
          </View>

          {/* Bottom Glass Panel Skeleton */}
          <View className="mt-auto">
            <View className="h-28 rounded-2xl bg-qasid-card/50 px-5 py-4 border border-white/5">
              {/* Skeleton line 1 */}
              <View className="h-4 bg-gray-700/30 rounded w-24 mb-3 animate-pulse" />
              {/* Skeleton line 2 */}
              <View className="h-4 bg-gray-700/30 rounded w-32 mb-2 animate-pulse" />
              {/* Skeleton line 3 */}
              <View className="h-4 bg-gray-700/30 rounded w-28 animate-pulse" />
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
