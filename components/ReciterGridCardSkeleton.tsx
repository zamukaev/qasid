import { Animated, View } from "react-native";
import { GOLD } from "../constants/colors";
import { usePulseAnimation } from "../hooks/usePulseAnimation";

export default function ReciterGridCardSkeleton() {
  const pulseStyle = usePulseAnimation();

  return (
    <View style={{ width: "30%", alignItems: "center" }}>
      <Animated.View
        className="rounded-full mb-3 bg-gray-700/30"
        style={[
          pulseStyle,
          {
            width: 128,
            height: 128,
            shadowColor: GOLD,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          },
        ]}
      />
      <Animated.View
        className="h-4 w-20 bg-gray-700/30 rounded"
        style={pulseStyle}
      />
    </View>
  );
}
