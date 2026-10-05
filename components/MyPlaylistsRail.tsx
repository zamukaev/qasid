import React, { useEffect } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { useUserPlaylistsStore } from "../stores/userPlaylistsStore";
import { useIsGuest } from "../stores/userStore";
import { UserPlaylist } from "../types/userPlaylist";
import HomeSectionShell from "./HomeSectionShell";
import { PlaylistCover } from "./PlaylistCover";

const CARD_WIDTH = 148;
const COVER_SIZE = 136;

type Props = {
  /** The tab whose stack the playlist screen opens in. */
  tab: "nasheeds" | "quran";
};

const PlaylistCard = React.memo(function PlaylistCard({
  playlist,
  onPress,
}: {
  playlist: UserPlaylist;
  onPress: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(playlist.id)}
      style={{ width: CARD_WIDTH }}
      accessibilityRole="button"
      accessibilityLabel={`Playlist ${playlist.title}`}
    >
      <PlaylistCover playlist={playlist} size={COVER_SIZE} />
      <Text className="mt-2 text-sm text-white" numberOfLines={1}>
        {playlist.title}
      </Text>
      <Text className="text-xs text-white/50">
        {playlist.track_count === 1
          ? "1 track"
          : `${playlist.track_count} tracks`}
      </Text>
    </TouchableOpacity>
  );
});

/**
 * The signed-in user's own playlists, the same list in both tabs. Hidden
 * until the first one exists — they are made from a track's "⋯" menu or the
 * "+" beside Play All.
 */
export function MyPlaylistsRail({ tab }: Props) {
  const router = useRouter();
  const isGuest = useIsGuest();
  const playlists = useUserPlaylistsStore((s) => s.playlists);

  useEffect(() => {
    if (isGuest) return;
    void useUserPlaylistsStore
      .getState()
      .hydrate()
      .catch(() => {});
  }, [isGuest]);

  const openPlaylist = React.useCallback(
    (id: string) =>
      router.push({
        pathname:
          tab === "nasheeds"
            ? "/(tabs)/nasheeds/my-playlist/[id]"
            : "/(tabs)/quran/my-playlist/[id]",
        params: { id },
      }),
    [router, tab],
  );

  // The section only exists once there is something in it.
  if (isGuest || playlists.length === 0) return null;

  return (
    <HomeSectionShell title="My Playlists">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4"
        contentContainerStyle={{ paddingLeft: 16 }}
      >
        <View className="flex-row">
          {playlists.map((playlist) => (
            <View key={playlist.id} className="mr-3">
              <PlaylistCard playlist={playlist} onPress={openPlaylist} />
            </View>
          ))}
        </View>
      </ScrollView>
    </HomeSectionShell>
  );
}
