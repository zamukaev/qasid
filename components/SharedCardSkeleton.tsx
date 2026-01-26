import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  className?: string;
};

export default function SharedCardSkeleton({ className = "" }: Props) {
  return (
    <View className={`relative overflow-hidden rounded-2xl ${className}`}>
      <View className="absolute inset-0 bg-[#0B0B10]" />
      <LinearGradient
        colors={[
          "rgba(231,193,28,0.14)",
          "rgba(231,193,28,0.05)",
          "rgba(0,0,0,0.00)",
          "rgba(0,0,0,0.45)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", inset: 0 }}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.55)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", inset: 0 }}
      />
      <View className="absolute inset-0 rounded-2xl border border-white/10" />

      <View className="flex-row items-center px-3 py-3">
        {/* Image Skeleton */}
        <View className="h-12 w-12 rounded-xl bg-gray-700/30 animate-pulse" />

        <View className="ml-3 flex-1">
          {/* Title Skeleton */}
          <View className="h-4 bg-gray-700/30 rounded w-3/4 mb-2 animate-pulse" />
          {/* Subtitle Skeleton */}
          <View className="h-3 bg-gray-700/30 rounded w-1/2 animate-pulse" />
        </View>
      </View>
    </View>
  );
}
