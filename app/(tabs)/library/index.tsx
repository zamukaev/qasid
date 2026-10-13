import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { PLAYLISTS_PITCH } from "../../../components/AddToPlaylistFlow";
import { PlaylistCover } from "../../../components/PlaylistCover";
import { PlaylistFormSheet } from "../../../components/PlaylistFormSheet";
import { PremiumRequiredSheet } from "../../../components/PremiumRequiredSheet";
import { GOLD } from "../../../constants/colors";
import { useAudioPlayer } from "../../../context/AudioPlayerContext";
import { getDownloads } from "../../../services/download-service";
import { useFavoritesStore } from "../../../stores/favoritesStore";
import { useUserPlaylistsStore } from "../../../stores/userPlaylistsStore";
import {
  useIsGuest,
  useIsPremium,
  useUserStore,
} from "../../../stores/userStore";
import { UserPlaylist } from "../../../types/userPlaylist";
import { createGate } from "../../../utils/user-playlists";

const ROW_COVER_SIZE = 56;
const SHORTCUT_ICON_SIZE = 20;
const MUTED_ICON = "rgba(255,255,255,0.4)";

type Sheet = "create" | "premium" | null;

const countLabel = (count: number) =>
  count === 1 ? "1 track" : `${count} tracks`;

function ShortcutRow({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      className="mb-3"
    >
      <View className="relative overflow-hidden rounded-2xl">
        <View className="absolute inset-0 bg-qasid-bg-2" />
        <LinearGradient
          colors={["rgba(201,168,76,0.05)", "rgba(0,0,0,0.00)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View className="absolute inset-0 rounded-2xl border border-white/10" />

        <View className="flex-row items-center px-4 py-4">
          <Feather name={icon} size={SHORTCUT_ICON_SIZE} color={GOLD} />
          <View className="ml-3 flex-1">
            <Text className="text-base text-white">{label}</Text>
            {!!subtitle && (
              <Text className="mt-0.5 text-[13px] text-white/50">
                {subtitle}
              </Text>
            )}
          </View>
          <Text className="text-base text-white/40">→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const PlaylistRow = React.memo(function PlaylistRow({
  playlist,
  onPress,
}: {
  playlist: UserPlaylist;
  onPress: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(playlist.id)}
      accessibilityRole="button"
      accessibilityLabel={`Playlist ${playlist.title}`}
      className="flex-row items-center py-2"
    >
      <PlaylistCover playlist={playlist} size={ROW_COVER_SIZE} rounded={8} />
      <View className="ml-3 flex-1">
        <Text className="text-base text-white" numberOfLines={1}>
          {playlist.title}
        </Text>
        <Text className="mt-0.5 text-[13px] text-white/50">
          {countLabel(playlist.track_count)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={MUTED_ICON} />
    </TouchableOpacity>
  );
});

function GuestCard() {
  const router = useRouter();
  return (
    <View className="relative mb-8 overflow-hidden rounded-3xl">
      <View className="absolute inset-0 bg-qasid-bg-2" />
      <View className="absolute inset-0 rounded-3xl border border-qasid-gold/30" />
      <View className="p-5">
        <Text className="text-xl font-semibold text-white">
          Build your library
        </Text>
        <Text className="mt-1 text-sm leading-5 text-white/60">
          Create a free account to make your own playlists, save favorites and
          download for offline listening.
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/signup")}
          className="mt-4 items-center rounded-2xl bg-qasid-gold py-3"
        >
          <Text className="text-base font-semibold text-qasid-black">
            Sign up for free
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/signin")}
          className="mt-2 items-center py-2"
        >
          <Text className="text-sm font-semibold text-qasid-gold">
            I already have an account
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * The signed-in user's own things in one tab: Favorites, Downloads and the
 * playlists they built. Guests get the sign-up card instead.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const { viewMode } = useAudioPlayer();
  const isGuest = useIsGuest();
  const isPremium = useIsPremium();
  const planResolved = useUserStore((s) => s.planResolved);
  const playlists = useUserPlaylistsStore((s) => s.playlists);
  const playlistsHydrated = useUserPlaylistsStore((s) => s.hydrated);
  const favoriteCount = useFavoritesStore((s) => s.ids.size);
  const favoritesHydrated = useFavoritesStore((s) => s.hydrated);

  const [downloadCount, setDownloadCount] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  useEffect(() => {
    if (isGuest) return;
    void useUserPlaylistsStore
      .getState()
      .hydrate()
      .catch(() => {});
  }, [isGuest]);

  // Downloads change from every other screen, so the count is re-read here.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getDownloads().then((map) => {
        if (active) setDownloadCount(Object.keys(map).length);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const openPlaylist = useCallback(
    (id: string) =>
      router.push({
        pathname: "/(tabs)/library/my-playlist/[id]",
        params: { id },
      }),
    [router],
  );

  const handleNewPlaylist = useCallback(() => {
    // Wait for RevenueCat rather than upselling a paying user after a cold start.
    if (!planResolved) return;
    const gate = createGate({ isPremium, playlistCount: playlists.length });
    setSheet(gate === "premium" ? "premium" : "create");
  }, [planResolved, isPremium, playlists.length]);
  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{
          paddingBottom: viewMode === "hidden" ? 32 : 128,
        }}
      >
        <View className="pb-6 pt-6">
          <Text className="text-3xl font-bold text-qasid-white">
            Your Library
          </Text>
        </View>

        {isGuest ? (
          <GuestCard />
        ) : (
          <>
            <ShortcutRow
              icon="heart"
              label="Favorites"
              subtitle={
                favoritesHydrated ? countLabel(favoriteCount) : undefined
              }
              onPress={() => router.push("/(tabs)/library/favorites")}
            />
            <ShortcutRow
              icon="download"
              label="Downloads"
              subtitle={
                downloadCount === null ? undefined : countLabel(downloadCount)
              }
              onPress={() => router.push("/(tabs)/library/downloads")}
            />

            <View className="mb-2 mt-6 flex-row items-center justify-between">
              <Text className="text-xl font-semibold text-qasid-white">
                Playlists
              </Text>
              <TouchableOpacity
                onPress={handleNewPlaylist}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="New playlist"
              >
                <Feather name="plus-circle" size={24} color={GOLD} />
              </TouchableOpacity>
            </View>

            {!playlistsHydrated ? (
              <View className="items-center py-8">
                <ActivityIndicator color={GOLD} />
              </View>
            ) : playlists.length === 0 ? (
              <View className="items-center px-6 pt-6">
                <Ionicons name="musical-notes-outline" size={36} color={GOLD} />
                <Text className="mt-3 text-center text-base text-white/70">
                  No playlists yet.
                </Text>
                <Text className="mt-1 text-center text-[13px] text-white/45">
                  Tap + above, ⋯ on any nasheed or surah, or + beside Play All
                  on an artist or reciter.
                </Text>
              </View>
            ) : (
              playlists.map((playlist) => (
                <PlaylistRow
                  key={playlist.id}
                  playlist={playlist}
                  onPress={openPlaylist}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      {sheet === "create" && <PlaylistFormSheet visible onClose={closeSheet} />}
      {sheet === "premium" && (
        <PremiumRequiredSheet
          visible
          onClose={closeSheet}
          title="Playlists"
          body={PLAYLISTS_PITCH}
        />
      )}
    </SafeAreaView>
  );
}
