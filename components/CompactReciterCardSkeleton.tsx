import { View } from "react-native";

export default function CompactReciterCardSkeleton() {
  return (
    <View className="items-center" style={{ width: 100 }}>
      {/* Avatar Skeleton */}
      <View
        className="rounded-full mb-2 bg-gray-700/30 animate-pulse"
        style={{
          width: 72,
          height: 72,
          shadowColor: "#E7C11C",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      />
      {/* Name Skeleton */}
      <View className="h-3 w-20 bg-gray-700/30 rounded mb-1 animate-pulse" />
      {/* Subtitle Skeleton */}
      <View className="h-2 w-16 bg-gray-700/30 rounded animate-pulse" />
    </View>
  );
}
