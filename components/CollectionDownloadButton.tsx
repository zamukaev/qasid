import React, { useCallback, useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";

import { GOLD } from "../constants/colors";
import { Track } from "../context/AudioPlayerContext";
import { useCollectionDownload } from "../hooks/useCollectionDownload";
import { CollectionDownloadSheet } from "./CollectionDownloadSheet";

const PERCENT_SCALE = 100;

type Props = {
  /**
   * What the collection would play — raw Storage paths as `uri` and exactly the
   * ids that go into the queue, so playback finds the files again offline.
   */
  tracks: readonly Track[];
  /** Fills the sheet's copy: "Download 114 surahs?" */
  itemNoun?: string;
  /** The collection's name, shown in the sheet's header. */
  subtitle?: string;
};

/**
 * Downloads a whole collection from its header, beside Play and the shuffle
 * icon. Single tracks keep their own row in the `⋯` sheet; this is the bulk
 * entry point.
 *
 * Every tap opens the sheet — the paywall, the confirmation and the remove
 * prompt all live there, so nothing happens behind the user's back. The hook is
 * owned here rather than in the sheet, so the download survives closing it.
 */
export const CollectionDownloadButton = React.memo(
  function CollectionDownloadButton({
    tracks,
    itemNoun = "tracks",
    subtitle,
  }: Props) {
    const [open, setOpen] = useState(false);
    const download = useCollectionDownload(tracks);

    const handleOpen = useCallback(() => setOpen(true), []);
    const handleClose = useCallback(() => setOpen(false), []);

    if (tracks.length === 0) return null;

    const { status, progress } = download;
    const downloading = status === "downloading";

    return (
      <>
        <TouchableOpacity
          onPress={handleOpen}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Offline downloads"
          className="items-center justify-center rounded-2xl px-4 py-3"
        >
          {downloading ? (
            // The percentage replaces the icon rather than sitting beside it,
            // so the row does not jump when the download starts.
            <Text className="text-[11px] font-semibold text-qasid-gold">
              {Math.round(progress * PERCENT_SCALE)}%
            </Text>
          ) : (
            <Feather
              name={status === "downloaded" ? "check-circle" : "download"}
              size={20}
              color={status === "idle" ? "#ffffff" : GOLD}
            />
          )}
        </TouchableOpacity>

        {open && (
          <CollectionDownloadSheet
            visible
            onClose={handleClose}
            subtitle={subtitle}
            itemNoun={itemNoun}
            download={download}
          />
        )}
      </>
    );
  },
);
