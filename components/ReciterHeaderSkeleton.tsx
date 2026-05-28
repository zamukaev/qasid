import { Animated, View } from "react-native";
import { GOLD } from "../constants/colors";
import { usePulseAnimation } from "../hooks/usePulseAnimation";

export default function ReciterHeaderSkeleton() {
  const pulseStyle = usePulseAnimation();

  return (
    <View className="px-5 pt-6">
      <View className="flex-row items-center">
        <Animated.View
          className="rounded-full mr-4 bg-gray-700/30"
          style={[
            pulseStyle,
            {
              width: 96,
              height: 96,
              shadowColor: GOLD,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
            },
          ]}
        />
        <View className="flex-1">
          <Animated.View
            className="h-6 w-32 bg-gray-700/30 rounded mb-2"
            style={pulseStyle}
          />
          <Animated.View
            className="h-4 w-40 bg-gray-700/30 rounded mb-2"
            style={pulseStyle}
          />
          <Animated.View
            className="h-3 w-28 bg-gray-700/30 rounded"
            style={pulseStyle}
          />
        </View>
      </View>

      <View className="mt-6">
        <Animated.View
          className="h-12 w-full bg-gray-700/30 rounded-xl"
          style={pulseStyle}
        />
      </View>
    </View>
  );
}
