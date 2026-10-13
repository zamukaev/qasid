import React, { useMemo } from "react";
import { Image, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { GOLD } from "../constants/colors";
import { useProgressiveStorageUrls } from "../hooks/useProgressiveStorageUrls";
import { UserPlaylist } from "../types/userPlaylist";

type Props = {
  playlist: Pick<UserPlaylist, "image_path" | "cover_paths">;
  size: number;
  /** A picked local file shown in place of the stored cover, in the form. */
  localImageUri?: string | null;
  rounded?: number;
};

const ICON_SIZE_RATIO = 0.4;
const COLLAGE_MIN_COVERS = 4;

/**
 * The user's own image, else a 2×2 collage of the first track covers (or the
 * first cover alone while there are fewer than four), else a music-note tile.
 */
export const PlaylistCover = React.memo(function PlaylistCover({
  playlist,
  size,
  localImageUri,
  rounded = 12,
}: Props) {
  const paths = useMemo(
    () => (playlist.image_path ? [playlist.image_path] : playlist.cover_paths),
    [playlist.image_path, playlist.cover_paths],
  );
  const urls = useProgressiveStorageUrls(paths);

  const frame = {
    width: size,
    height: size,
    borderRadius: rounded,
    overflow: "hidden" as const,
    backgroundColor: "#16161C",
  };

  if (localImageUri) {
    return (
      <View style={frame}>
        <Image
          source={{ uri: localImageUri }}
          style={{ width: size, height: size }}
        />
      </View>
    );
  }

  const resolved = paths
    .map((path) => urls.get(path))
    .filter((url): url is string => !!url);

  if (resolved.length === 0) {
    return (
      <View style={[frame, { alignItems: "center", justifyContent: "center" }]}>
        <Ionicons
          name="musical-notes"
          size={size * ICON_SIZE_RATIO}
          color={GOLD}
        />
      </View>
    );
  }

  if (resolved.length < COLLAGE_MIN_COVERS) {
    return (
      <View style={frame}>
        <Image
          source={{ uri: resolved[0] }}
          style={{ width: size, height: size }}
        />
      </View>
    );
  }

  const half = size / 2;
  return (
    <View style={[frame, { flexDirection: "row", flexWrap: "wrap" }]}>
      {resolved.slice(0, COLLAGE_MIN_COVERS).map((url) => (
        <Image
          key={url}
          source={{ uri: url }}
          style={{ width: half, height: half }}
        />
      ))}
    </View>
  );
});
