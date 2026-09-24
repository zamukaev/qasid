import React, { useCallback, useState } from "react";
import { TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";

import { GOLD } from "../constants/colors";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { PlaybackModeSheet, PlaybackModeSheetProps } from "./PlaybackModeSheet";

type Props = Omit<PlaybackModeSheetProps, "visible" | "onClose">;

/**
 * The shuffle icon that sits beside a collection's Play button. It opens the
 * playback-mode sheet rather than toggling shuffle outright, so the same three
 * modes the player screen offers are reachable before anything is playing.
 *
 * Mounted only while open, matching `TrackActionsButton` — a closed sheet costs
 * one icon.
 */
export const PlaybackModeButton = React.memo(function PlaybackModeButton(
  props: Props,
) {
  const [open, setOpen] = useState(false);
  const { repeatMode } = useAudioPlayer();

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <TouchableOpacity
        onPress={handleOpen}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Playback mode"
        className="items-center justify-center rounded-2xl px-4 py-3"
      >
        <Feather
          name="shuffle"
          size={20}
          color={repeatMode === "shuffle" ? GOLD : "#ffffff"}
        />
      </TouchableOpacity>

      {open && <PlaybackModeSheet visible onClose={handleClose} {...props} />}
    </>
  );
});
