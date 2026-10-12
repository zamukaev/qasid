import React, { useMemo } from "react";
import { View } from "react-native";

import PlaceholderAvatar from "../assets/images/avatar.webp";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { useCollectionPlayback } from "../hooks/useCollectionPlayback";
import { useProgressiveStorageUrls } from "../hooks/useProgressiveStorageUrls";
import { CollectionDoc } from "../utils/collections";
import HomeSectionShell from "./HomeSectionShell";
import { PremiumGateModal } from "./PremiumGateModal";
import SharedCardSkeleton from "./SharedCardSkeleton";
import {
  CollectionTrack,
  recommendedToCollectionTrack,
} from "./TrackCollectionScreen";
import { TrackCollectionRow } from "./TrackCollectionRow";

/** Rows on the home tab; the rest are one tap away under "See all". */
const PREVIEW_ROW_COUNT = 4;

interface Props {
  /** The `new` shelf collection, or undefined while it loads. */
  collection: CollectionDoc | undefined;
  isLoading: boolean;
  onPressSeeAll: (id: string) => void;
}

/**
 * The newest nasheeds as a short list of playable rows. Tapping a row plays
 * it with the whole new list as the queue; the queue ids match the
 * collection screen's, so the playing row stays highlighted on both.
 */
function NewNasheedsSection({ collection, isLoading, onPressSeeAll }: Props) {
  const { currentTrack, isPlaying } = useAudioPlayer();

  const tracks = useMemo<CollectionTrack[]>(
    () => collection?.tracks.map(recommendedToCollectionTrack) ?? [],
    [collection],
  );
  const preview = tracks.slice(0, PREVIEW_ROW_COUNT);

  const imagePaths = useMemo(
    () => tracks.slice(0, PREVIEW_ROW_COUNT).map((t) => t.imagePath),
    [tracks],
  );
  const imageUrls = useProgressiveStorageUrls(imagePaths);

  const trackPrefix = `collection-${collection?.id ?? "new"}`;
  const { onPlay, gateVisible, closeGate, playsLeft } = useCollectionPlayback({
    tracks,
    trackPrefix,
    artworkFor: (track) =>
      (track.imagePath ? imageUrls.get(track.imagePath) : undefined) ??
      PlaceholderAvatar,
  });

  if (!isLoading && preview.length === 0) return null;

  return (
    <HomeSectionShell
      title={collection?.name_en ?? "New on Qasid"}
      onPressSeeAll={
        collection ? () => onPressSeeAll(collection.id) : undefined
      }
    >
      <PremiumGateModal
        visible={gateVisible}
        playsLeft={playsLeft}
        onClose={closeGate}
      />
      {isLoading && preview.length === 0
        ? Array.from({ length: PREVIEW_ROW_COUNT }, (_, i) => (
            <View key={`skeleton-${i}`} className="mb-1">
              <SharedCardSkeleton />
            </View>
          ))
        : preview.map((item) => {
            const trackId = `${trackPrefix}-${item.id}`;
            const isActive = currentTrack?.id === trackId;
            return (
              <TrackCollectionRow
                key={item.id}
                trackId={trackId}
                nasheedId={item.id}
                title={item.title}
                artist={item.artist}
                audioPath={item.audioPath}
                imageUrl={
                  item.imagePath ? imageUrls.get(item.imagePath) : undefined
                }
                isActive={isActive}
                isPlaying={isPlaying && isActive}
                showActions
                nasheed={item.nasheed}
                onPlay={onPlay}
              />
            );
          })}
    </HomeSectionShell>
  );
}

export default React.memo(NewNasheedsSection);
