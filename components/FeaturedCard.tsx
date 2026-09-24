import React from "react";
import {
  CardVariantProps,
  CompactRailCard,
  CompactRailCardSkeleton,
  FEATURED_CARD_SIZES,
  resolveCardSize,
} from "./CompactRailCard";

interface FeaturedCardProps extends CardVariantProps {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  onPress: () => void;
}

export default function FeaturedCard({
  title,
  subtitle,
  imageUrl,
  onPress,
  circle,
  large,
  small,
}: FeaturedCardProps) {
  const { cardWidth, imageSize } = resolveCardSize(
    { large, small },
    FEATURED_CARD_SIZES,
  );

  return (
    <CompactRailCard
      imagePath={imageUrl}
      label={title}
      sublabel={subtitle}
      cardWidth={cardWidth}
      imageSize={imageSize}
      circle={circle}
      labelClassName={large ? "text-sm" : "text-xs"}
      onPress={onPress}
    />
  );
}

export function FeaturedCardSkeleton({ circle, large, small }: CardVariantProps) {
  const { cardWidth, imageSize } = resolveCardSize(
    { large, small },
    FEATURED_CARD_SIZES,
  );

  return (
    <CompactRailCardSkeleton
      cardWidth={cardWidth}
      imageSize={imageSize}
      circle={circle}
    />
  );
}
