import React, { useCallback, useState } from "react";
import { GestureResponderEvent, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { PremiumRequiredSheet } from "./PremiumRequiredSheet";
import { TrackActionsSheet, TrackActionsSheetProps } from "./TrackActionsSheet";

type Props = Omit<
  TrackActionsSheetProps,
  "visible" | "onClose" | "onRequirePremium"
>;

const INACTIVE_ICON = "rgba(255,255,255,0.35)";

/**
 * The `⋯` slot every track row puts in `SharedCard`'s `rightAction`.
 *
 * The sheet is mounted only while open, so a list of rows costs one icon each
 * — in particular `useDownload`'s filesystem probe runs per opened sheet, not
 * per visible row as the inline download button it replaced did.
 */
export const TrackActionsButton = React.memo(function TrackActionsButton(
  props: Props,
) {
  const [open, setOpen] = useState(false);
  // Raised by the actions sheet's download row for a free user. It only opens
  // once that sheet is gone: iOS drops a modal presented mid-dismissal.
  const [premiumOpen, setPremiumOpen] = useState(false);

  const handlePress = useCallback((event: GestureResponderEvent) => {
    // The surrounding SharedCard pressable starts playback otherwise.
    event.stopPropagation();
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);
  const handleRequirePremium = useCallback(() => setPremiumOpen(true), []);
  const handlePremiumClose = useCallback(() => setPremiumOpen(false), []);

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{ padding: 6 }}
      >
        <Ionicons name="ellipsis-horizontal" size={22} color={INACTIVE_ICON} />
      </TouchableOpacity>

      {open && (
        <TrackActionsSheet
          visible
          onClose={handleClose}
          onRequirePremium={handleRequirePremium}
          {...props}
        />
      )}

      {premiumOpen && (
        <PremiumRequiredSheet
          visible
          onClose={handlePremiumClose}
          subtitle={props.title}
        />
      )}
    </>
  );
});
