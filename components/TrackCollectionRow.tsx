import React, { useCallback, useMemo } from "react";

import { Nasheed } from "../types/nasheed";
import { SharedCard } from "./SharedCard";
import { FavoriteButton } from "./FavoriteButton";

interface Props {
  /** Queue-scoped id (`${trackPrefix}-${nasheed.id}`). */
  trackId: string;
  nasheedId: string;
  title: string;
  artist: string;
  audioPath: string | null;
  imageUrl?: string;
  /** This row is the currently loaded track. */
  isActive: boolean;
  /** This row is the currently loaded track *and* playback is running. */
  isPlaying: boolean;
  isFavorite: boolean;
  showFavorites: boolean;
  nasheed: Nasheed;
  onPlay: (nasheedId: string) => void;
}

/**
 * A single row of a track collection.
 *
 * Every prop is a primitive except `nasheed` (a stable object from the loaded
 * track) and `onPlay` (stabilised by the parent), so the memo comparison
 * actually holds: changing the playing track re-renders two rows, not the
 * whole list.
 */
export const TrackCollectionRow = React.memo(function TrackCollectionRow({
  trackId,
  nasheedId,
  title,
  artist,
  audioPath,
  imageUrl,
  isActive,
  isPlaying,
  isFavorite,
  showFavorites,
  nasheed,
  onPlay,
}: Props) {
  const handlePlayTrack = useCallback(
    () => onPlay(nasheedId),
    [onPlay, nasheedId],
  );

  const track = useMemo(
    () => ({ id: trackId, title, artist, uri: audioPath }),
    [trackId, title, artist, audioPath],
  );

  const rightAction = useMemo(
    () =>
      showFavorites ? (
        <FavoriteButton nasheed={nasheed} initialFavorite={isFavorite} />
      ) : undefined,
    [showFavorites, nasheed, isFavorite],
  );

  return (
    <SharedCard
      className="mb-1"
      handlePlayTrack={handlePlayTrack}
      isPlaying={isPlaying}
      isPaused={isActive}
      title={title}
      image={imageUrl}
      subtitle={artist}
      track={track}
      rightAction={rightAction}
    />
  );
});
