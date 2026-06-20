import React, { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { GOLD } from "../constants/colors";

export type EqualizerStatus = "hidden" | "playing" | "paused";

type QasidLiveEqualizerProps = {
  bars?: number;
  minHeight?: number;
  maxHeight?: number;
  barWidth?: number;
  gap?: number;
  color?: string;
  status?: EqualizerStatus;
  className?: string;
};

// One bar = one Reanimated shared value. The continuous randomized height
// animation runs entirely on the UI thread (useAnimatedStyle), so the per-frame
// updates never touch the JS/main thread or the Fabric mounting queue — the old
// Animated (useNativeDriver:false) version flooded the main thread and could
// trigger a 0x8BADF00D watchdog kill under the New Architecture.
function EqualizerBar({
  active,
  minHeight,
  maxHeight,
  barWidth,
  color,
}: {
  active: boolean;
  minHeight: number;
  maxHeight: number;
  barWidth: number;
  color: string;
}) {
  const v = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(v);
      v.value = withTiming(0, { duration: 200 });
      return;
    }

    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      v.value = withSequence(
        withTiming(Math.random(), {
          duration: 160 + Math.random() * 220,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(
          Math.random() * 0.3,
          {
            duration: 140 + Math.random() * 180,
            easing: Easing.inOut(Easing.ease),
          },
          (finished) => {
            "worklet";
            // Re-schedule the next cycle. This JS hop happens only ~3×/s per bar
            // (not per frame), so it's negligible compared to the bridge flood
            // the old implementation produced.
            if (finished) runOnJS(step)();
          }
        )
      );
    };
    step();

    return () => {
      cancelled = true;
      cancelAnimation(v);
    };
  }, [active, v]);

  const style = useAnimatedStyle(() => ({
    height: interpolate(v.value, [0, 1], [minHeight, maxHeight]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: barWidth,
          backgroundColor: color,
          borderRadius: barWidth / 2,
          opacity: 0.95,
        },
        style,
      ]}
    />
  );
}

export function QasidLiveEqualizer({
  bars = 3,
  minHeight = 6,
  maxHeight = 18,
  barWidth = 4,
  gap = 4,
  color = GOLD,
  status = "playing",
  className = "",
}: QasidLiveEqualizerProps) {
  // Pause the loop while backgrounded — no point animating off-screen, and it
  // keeps the app responsive during the suspend window.
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active"
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) =>
      setAppActive(s === "active")
    );
    return () => sub.remove();
  }, []);

  if (status === "hidden") return null;

  const active = status === "playing" && appActive;

  return (
    <View className={`flex-row items-end ${className}`} style={{ gap }}>
      {Array.from({ length: bars }, (_, i) => (
        <EqualizerBar
          key={i}
          active={active}
          // Preserve the original per-bar height variation (middle bar taller).
          minHeight={minHeight + (i === 1 ? 1 : 0)}
          maxHeight={maxHeight - (i === 1 ? 0 : 2)}
          barWidth={barWidth}
          color={color}
        />
      ))}
    </View>
  );
}
