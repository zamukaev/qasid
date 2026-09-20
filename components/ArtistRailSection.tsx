import React from "react";
import { useRouter } from "expo-router";
import { NasheedArtist, Playlist } from "../types/nasheed";
import {
  ARTIST_CARD_SIZES,
  CardVariantProps,
  CompactRailCard,
  resolveCardSize,
} from "./CompactRailCard";
import CompactArtistCardSkeleton from "./CompactArtistCardSkeleton";
import HorizontalRailSection from "./HorizontalRailSection";

interface CompactArtistCardProps extends CardVariantProps {
  artist: NasheedArtist | Playlist;
  onPress?: (id: string) => void;
}

function CompactArtistCard({
  artist,
  circle,
  large,
  small,
  onPress,
}: CompactArtistCardProps) {
  const router = useRouter();
  const { cardWidth, imageSize } = resolveCardSize(
    { large, small },
    ARTIST_CARD_SIZES,
  );

  return (
    <CompactRailCard
      imagePath={artist.image_path}
      label={artist.name_en}
      cardWidth={cardWidth}
      imageSize={imageSize}
      circle={circle}
      labelClassName={large ? "text-sm" : "text-xs"}
      onPress={() =>
        onPress
          ? onPress(artist.id)
          : router.push({
              pathname: "/(tabs)/nasheeds/artist/[id]",
              params: { id: artist.id },
            })
      }
    />
  );
}

interface ArtistRailSectionProps extends CardVariantProps {
  title: string;
  artists: NasheedArtist[] | Playlist[];
  isLoading?: boolean;
  onPressSeeAll?: () => void;
  onPressItem?: (id: string) => void;
  skeletonCount?: number;
}

function ArtistRailSection({
  title,
  artists,
  isLoading = false,
  onPressSeeAll,
  onPressItem,
  skeletonCount = 8,
  circle,
  large,
  small,
}: ArtistRailSectionProps) {
  return (
    <HorizontalRailSection
      title={title}
      items={artists}
      isLoading={isLoading}
      onPressSeeAll={onPressSeeAll}
      skeletonCount={skeletonCount}
      keyExtractor={(a) => a.id}
      renderItem={(a) => (
        <CompactArtistCard
          artist={a}
          circle={circle}
          large={large}
          small={small}
          onPress={onPressItem}
        />
      )}
      renderSkeleton={(_) => (
        <CompactArtistCardSkeleton
          circle={circle}
          large={large}
          small={small}
        />
      )}
    />
  );
}

export default React.memo(ArtistRailSection);
