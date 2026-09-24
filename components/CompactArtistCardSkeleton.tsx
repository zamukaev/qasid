import {
  ARTIST_CARD_SIZES,
  CardVariantProps,
  CompactRailCardSkeleton,
  resolveCardSize,
} from "./CompactRailCard";

export default function CompactArtistCardSkeleton({
  circle,
  large,
  small,
}: CardVariantProps) {
  const { cardWidth, imageSize } = resolveCardSize(
    { large, small },
    ARTIST_CARD_SIZES,
  );

  return (
    <CompactRailCardSkeleton
      cardWidth={cardWidth}
      imageSize={imageSize}
      circle={circle}
    />
  );
}
