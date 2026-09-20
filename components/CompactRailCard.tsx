import React from "react";
import { Image, Pressable, Text, View, Animated } from "react-native";
import { GOLD, GOLD_RIPPLE_20 } from "../constants/colors";
import { useImageLoadState } from "../hooks/useImageLoadState";
import { usePulseAnimation } from "../hooks/usePulseAnimation";
import ImageShimmerOverlay from "./ImageShimmerOverlay";

export interface CardVariantProps {
  circle?: boolean;
  large?: boolean;
  small?: boolean;
}

export type CardSize = { cardWidth: number; imageSize: number };

export type CardSizeTable = Record<"large" | "default" | "small", CardSize>;

// Geometry lives here rather than next to each rail so the cards and their
// skeletons can share a table without importing each other.
export const ARTIST_CARD_SIZES: CardSizeTable = {
  large: { cardWidth: 148, imageSize: 136 },
  default: { cardWidth: 116, imageSize: 104 },
  small: { cardWidth: 84, imageSize: 72 },
};

export const RECITER_CARD_SIZES: CardSizeTable = {
  large: { cardWidth: 116, imageSize: 104 },
  default: { cardWidth: 100, imageSize: 88 },
  small: { cardWidth: 84, imageSize: 72 },
};

export const FEATURED_CARD_SIZES: CardSizeTable = ARTIST_CARD_SIZES;

// One resolver for every rail: each card type keeps its own table, so a rail can
// still be tuned without touching the others.
export function resolveCardSize(
  { large, small }: CardVariantProps,
  sizes: CardSizeTable,
): CardSize {
  if (large) return sizes.large;
  if (small) return sizes.small;
  return sizes.default;
}

// A circular frame carries a slightly stronger glow than a rounded tile, which
// is what separates the "New Reciters" rail from the rest.
function frameStyle(circle: boolean | undefined, imageSize: number) {
  return {
    width: imageSize,
    height: imageSize,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: circle ? 0.3 : 0.2,
    shadowRadius: circle ? 8 : 6,
    elevation: circle ? 8 : 5,
  };
}

interface CompactRailCardProps {
  imagePath?: string;
  label: string;
  sublabel?: string;
  cardWidth: number;
  imageSize: number;
  circle?: boolean;
  labelClassName?: string;
  onPress: () => void;
}

export function CompactRailCard({
  imagePath,
  label,
  sublabel,
  cardWidth,
  imageSize,
  circle,
  labelClassName = "text-xs",
  onPress,
}: CompactRailCardProps) {
  const { source, showSkeleton, onLoad, onError } = useImageLoadState(imagePath);

  return (
    <Pressable
      style={{ width: cardWidth }}
      className="items-center active:opacity-80"
      android_ripple={{ color: GOLD_RIPPLE_20 }}
      onPress={onPress}
    >
      <View
        className={`${circle ? "rounded-full" : "rounded-xl"} overflow-hidden border border-qasid-gold/20 mb-2`}
        style={frameStyle(circle, imageSize)}
      >
        <Image
          source={source}
          onLoad={onLoad}
          onError={onError}
          className="w-full h-full"
          resizeMode="cover"
        />
        <ImageShimmerOverlay
          visible={showSkeleton}
          rounded={circle ? "full" : "xl"}
        />
      </View>
      <Text
        className={`text-white/90 text-center leading-4 ${labelClassName}`}
        numberOfLines={2}
      >
        {label}
      </Text>
      {!!sublabel && (
        <Text
          className="text-qasid-gold/80 text-center text-[11px] leading-4 mt-0.5"
          numberOfLines={1}
        >
          {sublabel}
        </Text>
      )}
    </Pressable>
  );
}

interface CompactRailCardSkeletonProps {
  cardWidth: number;
  imageSize: number;
  circle?: boolean;
  secondBarClass?: string;
}

export function CompactRailCardSkeleton({
  cardWidth,
  imageSize,
  circle,
  secondBarClass = "w-14",
}: CompactRailCardSkeletonProps) {
  const pulseStyle = usePulseAnimation();

  return (
    <View className="items-center" style={{ width: cardWidth }}>
      <Animated.View
        className={`${circle ? "rounded-full" : "rounded-xl"} mb-2 bg-gray-700/30`}
        style={[pulseStyle, frameStyle(circle, imageSize)]}
      />
      <Animated.View
        className="h-3 w-20 bg-gray-700/30 rounded mb-1"
        style={pulseStyle}
      />
      <Animated.View
        className={`h-2 ${secondBarClass} bg-gray-700/30 rounded`}
        style={pulseStyle}
      />
    </View>
  );
}
