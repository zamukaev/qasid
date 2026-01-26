import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

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

export function QasidLiveEqualizer({
  bars = 3,
  minHeight = 6,
  maxHeight = 18,
  barWidth = 4,
  gap = 4,
  color = "#E7C11C",
  status = "playing",
  className = "",
}: QasidLiveEqualizerProps) {
  const values = useRef(
    Array.from({ length: bars }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    console.log("Equalizer status:", status);
    if (status === "paused") {
      values.forEach((v) => {
        v.stopAnimation();
        Animated.timing(v, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      });
      return;
    }

    const animateBar = (v: Animated.Value) => {
      const loop = () => {
        Animated.sequence([
          Animated.timing(v, {
            toValue: Math.random(),
            duration: 160 + Math.random() * 220,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(v, {
            toValue: Math.random() * 0.3,
            duration: 140 + Math.random() * 180,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]).start((result) => {
          if (result.finished) {
            loop();
          }
        });
      };
      loop();
    };

    values.forEach(animateBar);

    return () => values.forEach((v) => v.stopAnimation());
  }, [status, values]);

  if (status === "hidden") return null;

  return (
    <View className={`flex-row items-end ${className}`} style={{ gap }}>
      {values.map((v, i) => {
        const height = v.interpolate({
          inputRange: [0, 1],
          outputRange: [
            minHeight + (i === 1 ? 1 : 0),
            maxHeight - (i === 1 ? 0 : 2),
          ],
        });

        return (
          <Animated.View
            key={i}
            style={{
              width: barWidth,
              height,
              backgroundColor: color,
              borderRadius: barWidth / 2,
              opacity: 0.95,
            }}
          />
        );
      })}
    </View>
  );
}
