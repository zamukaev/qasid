import { useCallback, useEffect, useRef, useState } from "react";

import { MODAL_HANDOFF_MS } from "../hooks/useBottomSheet";
import { useIsPremium } from "../stores/userStore";
import { UserPlaylistTrackInput } from "../types/userPlaylist";
import {
  FREE_PLAYLIST_LIMIT,
  FREE_PLAYLIST_TRACK_LIMIT,
} from "../utils/user-playlists";
import {
  AddToPlaylistNext,
  AddToPlaylistSheet,
  CollectionPlaylistSeed,
} from "./AddToPlaylistSheet";
import { PlaylistFormResult, PlaylistFormSheet } from "./PlaylistFormSheet";
import { PremiumRequiredSheet } from "./PremiumRequiredSheet";

const PLAYLISTS_PITCH = `Free accounts get ${FREE_PLAYLIST_LIMIT} playlist. Upgrade to make as many as you like.`;
const TRACKS_PITCH = `Free playlists hold up to ${FREE_PLAYLIST_TRACK_LIMIT} tracks. Upgrade for bigger playlists.`;

/** "between" — one sheet has gone, the next waits out the modal hand-off. */
type Stage = "pick" | "between" | AddToPlaylistNext;

type Props = {
  /** One track, or a whole artist / reciter list. */
  items: readonly UserPlaylistTrackInput[];
  /** The track title, or a label for the list. */
  title: string;
  /** Resolved artwork for the picker header. */
  image?: string;
  /** From a collection's "+": "New playlist" skips the form. */
  seed?: CollectionPlaylistSeed;
  /** Every sheet of the flow is gone. */
  onDone: () => void;
};

/**
 * Picker → (new-playlist form | upgrade sheet), one sheet at a time. Mount it
 * only while active. Each hand-off waits until the previous sheet has fully
 * dismissed, because iOS drops a modal presented during another's dismissal.
 */
export function AddToPlaylistFlow({
  items,
  title,
  image,
  seed,
  onDone,
}: Props) {
  const [stage, setStage] = useState<Stage>("pick");
  const isPremium = useIsPremium();
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current);
    },
    [],
  );

  const continueWith = useCallback(
    (next?: AddToPlaylistNext) => {
      if (!next) {
        onDone();
        return;
      }
      setStage("between");
      handoffTimerRef.current = setTimeout(
        () => setStage(next),
        MODAL_HANDOFF_MS,
      );
    },
    [onDone],
  );

  // A free user's new playlist got what fit; the upgrade sheet explains the rest.
  const handleFormClosed = useCallback(
    (result?: PlaylistFormResult) =>
      continueWith(
        result && result.overflow > 0 && !isPremium
          ? "premium-tracks"
          : undefined,
      ),
    [continueWith, isPremium],
  );

  switch (stage) {
    case "pick":
      return (
        <AddToPlaylistSheet
          visible
          onClose={continueWith}
          items={items}
          title={title}
          image={image}
          seed={seed}
        />
      );
    case "between":
      return null;
    case "create":
      return (
        <PlaylistFormSheet
          visible
          onClose={handleFormClosed}
          tracksToAdd={items}
          addingLabel={items.length === 1 ? `“${title}”` : title}
        />
      );
    case "premium-playlists":
    case "premium-tracks":
      return (
        <PremiumRequiredSheet
          visible
          onClose={onDone}
          title="Playlists"
          subtitle={title}
          body={stage === "premium-playlists" ? PLAYLISTS_PITCH : TRACKS_PITCH}
        />
      );
  }
}
