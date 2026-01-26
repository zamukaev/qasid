import { View } from "react-native";

export default function MoodChipSkeleton() {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        backgroundColor: "rgba(20, 20, 22, 0.85)",
        borderColor: "rgba(255, 255, 255, 0.05)",
      }}
    >
      <View className="h-4 w-20 bg-gray-700/30 rounded animate-pulse" />
    </View>
  );
}
