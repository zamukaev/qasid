import React, { useCallback, useState } from "react";
import { TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useRequireAccount } from "../hooks/useRequireAccount";
import { UserPlaylistTrackInput } from "../types/userPlaylist";
import { AddToPlaylistFlow } from "./AddToPlaylistFlow";
import { CollectionPlaylistSeed } from "./AddToPlaylistSheet";

const ICON_SIZE = 20;
const ICON_COLOR = "#ffffff";

type Props = {
  /** Every playable track of the collection, in its order. */
  items: readonly UserPlaylistTrackInput[];
  /** What the picker calls the list, e.g. "All nasheeds · Artist". */
  title: string;
  /** Resolved artwork for the picker header. */
  image?: string;
  /**
   * Name and image of the collection. "New playlist" then creates the
   * playlist right away under that name and cover, with no form.
   */
  seed: CollectionPlaylistSeed;
};

/**
 * The "+" beside a collection's Play All: adds the whole artist or reciter
 * list to a playlist. Styled like its neighbours (shuffle, download).
 */
export const AddToPlaylistButton = React.memo(function AddToPlaylistButton({
  items,
  title,
  image,
  seed,
}: Props) {
  const [open, setOpen] = useState(false);
  const { requireAccount } = useRequireAccount();

  const handlePress = useCallback(() => {
    if (requireAccount("add tracks to your playlists")) setOpen(true);
  }, [requireAccount]);
  const handleDone = useCallback(() => setOpen(false), []);

  if (items.length === 0) return null;

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Add all to a playlist"
        className="items-center justify-center rounded-2xl px-4 py-3"
      >
        <Feather name="plus-circle" size={ICON_SIZE} color={ICON_COLOR} />
      </TouchableOpacity>

      {open && (
        <AddToPlaylistFlow
          items={items}
          title={title}
          image={image}
          seed={seed}
          onDone={handleDone}
        />
      )}
    </>
  );
});
