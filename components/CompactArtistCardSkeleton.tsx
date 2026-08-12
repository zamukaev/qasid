import { Animated, View } from "react-native";
import { GOLD } from "../constants/colors";
import { usePulseAnimation } from "../hooks/usePulseAnimation";

function resolveSize(large?: boolean, small?: boolean) {
  if (large) return { cardWidth: 148, imageSize: 136 };
  if (small) return { cardWidth: 84, imageSize: 72 };
  return { cardWidth: 116, imageSize: 104 };
}

interface CompactArtistCardSkeletonProps {
  circle?: boolean;
  large?: boolean;
  small?: boolean;
}

export default function CompactArtistCardSkeleton({
  circle,
  large,
  small,
}: CompactArtistCardSkeletonProps) {
  const { cardWidth, imageSize } = resolveSize(large, small);
  const pulseStyle = usePulseAnimation();

  return (
    <View className="items-center" style={{ width: cardWidth }}>
      <Animated.View
        className={`${circle ? "rounded-full" : "rounded-xl"} mb-2 bg-gray-700/30`}
        style={[
          pulseStyle,
          {
            width: imageSize,
            height: imageSize,
            shadowColor: GOLD,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: circle ? 0.3 : 0.2,
            shadowRadius: circle ? 8 : 6,
            elevation: circle ? 8 : 5,
          },
        ]}
      />
      <Animated.View
        className="h-3 w-20 bg-gray-700/30 rounded mb-1"
        style={pulseStyle}
      />
      <Animated.View
        className="h-2 w-14 bg-gray-700/30 rounded"
        style={pulseStyle}
      />
    </View>
  );
}
