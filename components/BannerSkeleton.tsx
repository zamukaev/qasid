import { View, Animated } from "react-native";
import { useEffect, useRef } from "react";

export default function BannerSkeleton() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <View className="w-full h-56 overflow-hidden bg-qasid-card relative mb-4 rounded-2xl">
      <Animated.View
        style={{ opacity }}
        className="absolute inset-0 bg-gray-700/30"
      />
      <View className="absolute inset-0 bg-black/30" />
      <View className="absolute inset-0 items-center justify-center px-4">
        {/* Title Skeleton */}
        <View className="h-8 w-48 bg-gray-700/40 rounded-lg mb-3 animate-pulse" />
        {/* Subtitle Skeleton */}
        <View className="h-4 w-32 bg-gray-700/30 rounded animate-pulse" />
      </View>
      {/* Play Button Skeleton */}
      <View className="absolute bottom-4 w-1/2 left-1/4">
        <View className="h-12 bg-gray-700/30 rounded-xl animate-pulse" />
      </View>
    </View>
  );
}
