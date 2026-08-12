import { Animated } from "react-native";
import { usePulseAnimation } from "../hooks/usePulseAnimation";

interface ImageShimmerOverlayProps {
  visible: boolean;
  rounded?: "full" | "xl" | "none";
}

export default function ImageShimmerOverlay({
  visible,
  rounded = "xl",
}: ImageShimmerOverlayProps) {
  const pulseStyle = usePulseAnimation();

  if (!visible) return null;

  const radiusClass =
    rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : "";

  return (
    <Animated.View
      pointerEvents="none"
      className={`absolute inset-0 ${radiusClass} bg-gray-700/30`}
      style={pulseStyle}
    />
  );
}
