import React, { useState } from "react";
import { TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GOLD } from "../constants/colors";
import { Nasheed } from "../types/nasheed";
import { toggleFavorite } from "../services/favorites-service";

type Props = {
  nasheed: Nasheed;
  initialFavorite?: boolean;
  onChange?: (favorited: boolean) => void;
};

export function FavoriteButton({ nasheed, initialFavorite, onChange }: Props) {
  const [favorited, setFavorited] = useState(!!initialFavorite);
  const [busy, setBusy] = useState(false);

  const handlePress = async (event: any) => {
    event?.stopPropagation?.();
    if (busy) return;
    setBusy(true);
    // Optimistic toggle, reconciled with the server result.
    const optimistic = !favorited;
    setFavorited(optimistic);
    try {
      const result = await toggleFavorite(nasheed);
      setFavorited(result);
      onChange?.(result);
    } catch (e) {
      console.warn("toggleFavorite failed", e);
      setFavorited(!optimistic);
    } finally {
      setBusy(false);
    }
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
}
