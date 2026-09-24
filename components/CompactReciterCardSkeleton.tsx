import {
  CardVariantProps,
  CompactRailCardSkeleton,
  RECITER_CARD_SIZES,
  resolveCardSize,
} from "./CompactRailCard";

export default function CompactReciterCardSkeleton({
  circle,
  large,
  small,
}: CardVariantProps) {
  const { cardWidth, imageSize } = resolveCardSize(
    { large, small },
    RECITER_CARD_SIZES,
  );

  return (
    <CompactRailCardSkeleton
      cardWidth={cardWidth}
      imageSize={imageSize}
      circle={circle}
      secondBarClass="w-16"
    />
  );
}
