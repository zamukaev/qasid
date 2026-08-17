// TEMP admin curation hotfix — remove with PlaylistPickerModal.
import React from "react";
import { GestureResponderEvent, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GOLD } from "../constants/colors";
import { Nasheed } from "../types/nasheed";
import { useIsAdmin } from "../hooks/useIsAdmin";

type Props = {
  nasheed: Nasheed;
  onPress: (nasheed: Nasheed) => void;
};

export const AdminPlaylistButton = React.memo(function AdminPlaylistButton({
  nasheed,
  onPress,
}: Props) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;

  const assigned = !!nasheed.playlist_id;

  const handlePress = (event: GestureResponderEvent) => {
    // The surrounding SharedCard pressable starts playback otherwise.
    event.stopPropagation();
    onPress(nasheed);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{ padding: 6 }}
    >
      <Ionicons
        name={assigned ? "add-circle" : "add-circle-outline"}
        size={22}
        color={assigned ? GOLD : "rgba(255,255,255,0.35)"}
      />
    </TouchableOpacity>
  );
});
