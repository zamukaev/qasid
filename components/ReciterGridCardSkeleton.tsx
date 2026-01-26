import { View, Text } from "react-native";

export default function ReciterGridCardSkeleton() {
  return (
    <View
      style={{
        width: "30%",
        alignItems: "center",
      }}
    >
      {/* Avatar Skeleton */}
      <View
        className="rounded-full mb-3 bg-gray-700/30 animate-pulse"
        style={{
          width: 128,
          height: 128,
          shadowColor: "#E7C11C",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      />
      {/* Name Skeleton */}
      <View className="h-4 w-20 bg-gray-700/30 rounded animate-pulse" />
    </View>
  );
}
