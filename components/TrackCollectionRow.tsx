import React, { useCallback, useMemo } from "react";

import { Nasheed } from "../types/nasheed";
import { SharedCard } from "./SharedCard";
import { TrackActionsButton } from "./TrackActionsButton";

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
  /** Render the `⋯` actions menu on this row. */
  showActions: boolean;
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
  showActions,
  nasheed,
  onPlay,
}: Props) {
  const handlePlayTrack = useCallback(
    () => onPlay(nasheedId),
    [onPlay, nasheedId],
  );

  const track = useMemo(
    () => ({ id: trackId, title, artist, isNasheed: true, uri: audioPath }),
    [trackId, title, artist, audioPath],
  );

  const rightAction = useMemo(
    () =>
      showActions ? (
        <TrackActionsButton
          title={title}
          subtitle={artist}
          image={imageUrl}
          nasheed={nasheed}
          track={track}
          showGoToArtist
        />
      ) : undefined,
    [showActions, title, artist, imageUrl, nasheed, track],
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
