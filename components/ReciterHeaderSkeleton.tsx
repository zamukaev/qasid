import { View } from "react-native";

export default function ReciterHeaderSkeleton() {
  return (
    <View className="px-5 pt-6">
      <View className="flex-row items-center">
        {/* Avatar Skeleton */}
        <View
          className="rounded-full mr-4 bg-gray-700/30 animate-pulse"
          style={{
            width: 96,
            height: 96,
            shadowColor: "#E7C11C",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
          }}
        />
        <View className="flex-1">
          {/* Name Skeleton */}
          <View className="h-6 w-32 bg-gray-700/30 rounded mb-2 animate-pulse" />
          {/* Subtitle Skeleton */}
          <View className="h-4 w-40 bg-gray-700/30 rounded mb-2 animate-pulse" />
          {/* Info Skeleton */}
          <View className="h-3 w-28 bg-gray-700/30 rounded animate-pulse" />
        </View>
      </View>

      {/* Description Skeleton */}
      <View className="mt-6">
        <View className="h-4 w-full bg-gray-700/30 rounded mb-2 animate-pulse" />
        <View className="h-4 w-5/6 bg-gray-700/30 rounded mb-2 animate-pulse" />
        <View className="h-4 w-4/6 bg-gray-700/30 rounded animate-pulse" />
      </View>

      {/* Play Button Skeleton */}
      <View className="mt-6">
        <View className="h-12 w-full bg-gray-700/30 rounded-xl mb-4 animate-pulse" />

        {/* Repeat Mode Controls Skeleton */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1 h-10 bg-gray-700/30 rounded-xl mr-2 animate-pulse" />
          <View className="flex-1 h-10 bg-gray-700/30 rounded-xl mx-1 animate-pulse" />
          <View className="flex-1 h-10 bg-gray-700/30 rounded-xl ml-2 animate-pulse" />
        </View>
      </View>
    </View>
  );
}
