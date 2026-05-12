import { View } from "react-native";
import { CompactReciterCardVariantProps } from "./ReciterCard";

function resolveSize(large?: boolean, small?: boolean) {
  if (large) return { cardWidth: 116, imageSize: 104 };
  if (small) return { cardWidth: 84, imageSize: 72 };
  return { cardWidth: 100, imageSize: 88 };
}

export default function CompactReciterCardSkeleton({
  circle,
  large,
  small,
}: CompactReciterCardVariantProps) {
  const { cardWidth, imageSize } = resolveSize(large, small);
  return (
    <View className="items-center" style={{ width: cardWidth }}>
      <View
        className={`${circle ? "rounded-full" : "rounded-xl"} mb-2 bg-gray-700/30 animate-pulse`}
        style={{
          width: imageSize,
          height: imageSize,
          shadowColor: "#C9A84C",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: circle ? 0.3 : 0.2,
          shadowRadius: circle ? 8 : 6,
          elevation: circle ? 8 : 5,
        }}
      />
      <View className="h-3 w-20 bg-gray-700/30 rounded mb-1 animate-pulse" />
      <View className="h-2 w-16 bg-gray-700/30 rounded animate-pulse" />
    </View>
  );
}
