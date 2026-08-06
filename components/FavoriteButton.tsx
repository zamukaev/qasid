import React from "react";
import { GestureResponderEvent, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GOLD } from "../constants/colors";
import { Nasheed } from "../types/nasheed";
import { useFavoritesStore, useIsFavorite } from "../stores/favoritesStore";

type Props = {
  nasheed: Nasheed;
};

export const FavoriteButton = React.memo(function FavoriteButton({
  nasheed,
}: Props) {
  const favorited = useIsFavorite(nasheed.id);
  const toggle = useFavoritesStore((s) => s.toggle);

  const handlePress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    // The store toggles optimistically and ignores taps while its own write
    // is in flight, so there is no local state to keep here.
    void toggle(nasheed);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{ padding: 6 }}
    >
      <Ionicons
        name={favorited ? "heart" : "heart-outline"}
        size={22}
        color={favorited ? GOLD : "rgba(255,255,255,0.35)"}
      />
    </TouchableOpacity>
  );
});
