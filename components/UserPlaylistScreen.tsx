import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItemInfo,
  Platform,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import PlaceholderAvatar from "../assets/images/avatar.webp";
import { GOLD } from "../constants/colors";
import { Track, useAudioPlayer } from "../context/AudioPlayerContext";
import { markManualPlay, useNasheedLimit } from "../hooks/useNasheedLimit";
import { useProgressiveStorageUrls } from "../hooks/useProgressiveStorageUrls";
import { resolveStorageUrlPrioritized } from "../services/storage";
import { fetchUserPlaylistTracks } from "../services/user-playlists-service";
import {
  useUserPlaylist,
  useUserPlaylistsStore,
} from "../stores/userPlaylistsStore";
import { useIsPremium } from "../stores/userStore";
import { UserPlaylistTrack } from "../types/userPlaylist";
import { pickRandom } from "../utils/random";
import { capNasheedsInQueue, rotateFrom } from "../utils/user-playlists";
import { ActionListItem, ActionListSheet } from "./ActionListSheet";
import { CollectionDownloadButton } from "./CollectionDownloadButton";
import { PlaybackModeButton } from "./PlaybackModeButton";
import { PlayButton, PlayButtonVariant } from "./PlayButton";
import { PlaylistCover } from "./PlaylistCover";
import { PlaylistFormSheet } from "./PlaylistFormSheet";
import { PremiumGateModal } from "./PremiumGateModal";
import { SharedCard } from "./SharedCard";
import SharedCardSkeleton from "./SharedCardSkeleton";

const HEADER_COVER_SIZE = 160;
const SKELETON_ROW_COUNT = 6;
const INACTIVE_ICON = "rgba(255,255,255,0.35)";
const HEADER_ACTION_ICON_SIZE = 20;
const HEADER_ACTION_ICON_COLOR = "#ffffff";

const keyExtractor = (track: UserPlaylistTrack) => track.key;

type PlaylistRowProps = {
  track: UserPlaylistTrack;
  trackId: string;
  imageUrl?: string;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (key: string) => void;
  onMenu: (track: UserPlaylistTrack) => void;
};

const PlaylistRow = React.memo(function PlaylistRow({
  track,
  trackId,
  imageUrl,
  isActive,
  isPlaying,
  onPlay,
  onMenu,
}: PlaylistRowProps) {
  const rowTrack = useMemo<Track>(
    () => ({
      id: trackId,
      title: track.title,
      artist: track.subtitle,
      isNasheed: track.kind === "nasheed",
      uri: track.audio_path,
    }),
    [trackId, track],
  );

  return (
    <SharedCard
      className="mb-1"
      title={track.title}
      subtitle={track.subtitle}
      image={imageUrl}
      track={rowTrack}
      handlePlayTrack={() => onPlay(track.key)}
      isPlaying={isPlaying}
      isPaused={isActive}
      rightAction={
        <TouchableOpacity
          onPress={(event) => {
            // The surrounding SharedCard pressable starts playback otherwise.
            event.stopPropagation();
            onMenu(track);
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ padding: 6 }}
          accessibilityLabel="Track options"
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={22}
            color={INACTIVE_ICON}
          />
        </TouchableOpacity>
      }
    />
  );
});

/**
 * One of the user's own playlists, mounted in both the Nasheeds and the Quran
 * stack. Nasheeds and surahs share one queue; for a free user only the
 * nasheeds in it count against (and are capped by) the daily limit.
 */
export function UserPlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlistId = String(id ?? "");
  const router = useRouter();
  const trackPrefix = `myplaylist-${playlistId}-`;

  const playlist = useUserPlaylist(playlistId);
  const hydrated = useUserPlaylistsStore((s) => s.hydrated);
  const removeTrack = useUserPlaylistsStore((s) => s.removeTrack);
  const removePlaylist = useUserPlaylistsStore((s) => s.remove);

  const isPremium = useIsPremium();
  const { canPlay, increment, playsLeft } = useNasheedLimit();
  const {
    playTrack,
    setQueue,
    currentTrack,
    pause,
    resume,
    isPlaying,
    viewMode,
  } = useAudioPlayer();

  const [tracks, setTracks] = useState<UserPlaylistTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gateVisible, setGateVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [menuTrack, setMenuTrack] = useState<UserPlaylistTrack | null>(null);
  const pendingPlayIdRef = useRef(0);

  useEffect(() => {
    void useUserPlaylistsStore
      .getState()
      .hydrate()
      .catch(() => {});
  }, []);

  const loadTracks = useCallback(async () => {
    try {
      setError(null);
      setTracks(await fetchUserPlaylistTracks(playlistId));
    } catch (e) {
      console.warn("fetchUserPlaylistTracks failed", e);
      setError("Couldn't load this playlist. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  // Refetched on focus and whenever the playlist changes elsewhere (a track
  // added from another tab while this screen sits in the stack).
  const updatedAt = playlist?.updatedAt;
  useFocusEffect(
    useCallback(() => {
      void loadTracks();
    }, [loadTracks, updatedAt]),
  );

  const imagePaths = useMemo(() => tracks.map((t) => t.image_path), [tracks]);
  const imageUrls = useProgressiveStorageUrls(imagePaths);
  const artworkFor = useCallback(
    (track: UserPlaylistTrack) =>
      track.image_path
        ? (imageUrls.get(track.image_path) ??
          (track.image_path.startsWith("http") ? track.image_path : undefined))
        : undefined,
    [imageUrls],
  );

  const playable = useMemo(
    () => tracks.filter((t) => !!t.audio_path),
    [tracks],
  );

  const toQueueTrack = useCallback(
    (track: UserPlaylistTrack): Track => ({
      id: `${trackPrefix}${track.key}`,
      title: track.title,
      artist: track.subtitle,
      artworkUri: artworkFor(track) ?? PlaceholderAvatar,
      isNasheed: track.kind === "nasheed",
      surahNumber: track.kind === "surah" ? track.surah_number : undefined,
      // Raw paths: playTrack resolves them lazily.
      uri: { uri: track.audio_path },
    }),
    [trackPrefix, artworkFor],
  );

  // Raw storage paths and the same ids the queue uses — downloadTrack needs
  // the path, and playback looks the file up by that id.
  const downloadTracks = useMemo<Track[]>(
    () =>
      playable.map((track) => ({
        id: `${trackPrefix}${track.key}`,
        title: track.title,
        artist: track.subtitle,
        isNasheed: track.kind === "nasheed",
        uri: track.audio_path,
      })),
    [playable, trackPrefix],
  );

  const handlePlay = async (track: UserPlaylistTrack) => {
    const trackId = `${trackPrefix}${track.key}`;
    if (currentTrack?.id === trackId) {
      isPlaying ? await pause() : await resume();
      return;
    }

    const isNasheed = track.kind === "nasheed";
    if (isNasheed && !canPlay(isPremium)) {
      setGateVisible(true);
      return;
    }

    const playId = ++pendingPlayIdRef.current;
    let audioUrl: string;
    try {
      audioUrl = await resolveStorageUrlPrioritized(track.audio_path);
    } catch {
      return;
    }
    if (playId !== pendingPlayIdRef.current) return;

    // Only after a successful resolve, so a network blip costs no daily play.
    if (isNasheed && !isPremium) await increment();

    const index = playable.findIndex((t) => t.key === track.key);
    const ordered = isPremium
      ? playable
      : capNasheedsInQueue(
          rotateFrom(playable, Math.max(0, index)),
          (t) => t.kind === "nasheed",
          playsLeft,
        );
    setQueue(ordered.map(toQueueTrack));

    // Only nasheeds: useNasheedPlaybackGuards consumes this flag on the next
    // nasheed it sees, so setting it for a surah would skip a real count.
    if (isNasheed) markManualPlay();
    await playTrack({ ...toQueueTrack(track), uri: { uri: audioUrl } });
  };

  const handlePlayRef = useRef(handlePlay);
  const playableRef = useRef(playable);
  useEffect(() => {
    handlePlayRef.current = handlePlay;
    playableRef.current = playable;
  });

  const onPlay = useCallback((key: string) => {
    const track = playableRef.current.find((t) => t.key === key);
    if (track) void handlePlayRef.current(track);
  }, []);
  const handlePlayAll = useCallback(() => {
    const first = playableRef.current[0];
    if (first) void handlePlayRef.current(first);
  }, []);
  const handlePlayShuffled = useCallback(() => {
    const track = pickRandom(playableRef.current);
    if (track) void handlePlayRef.current(track);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!playlist) return;
    Alert.alert(
      "Delete playlist",
      `“${playlist.title}” will be deleted. The tracks themselves stay in Qasid.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removePlaylist(playlist.id);
              router.back();
            } catch {
              Alert.alert("Couldn't delete the playlist", "Please try again.");
            }
          },
        },
      ],
    );
  }, [playlist, removePlaylist, router]);

  const playlistActions = useMemo<ActionListItem[]>(
    () => [
      {
        key: "edit",
        icon: "create-outline",
        label: "Edit playlist",
        onPress: () => setEditOpen(true),
      },
      {
        key: "delete",
        icon: "trash-outline",
        label: "Delete playlist",
        onPress: confirmDelete,
        destructive: true,
      },
    ],
    [confirmDelete],
  );

  const trackActions = useMemo<ActionListItem[]>(() => {
    if (!menuTrack) return [];
    const list: ActionListItem[] = [
      {
        key: "remove",
        icon: "remove-circle-outline",
        label: "Remove from this playlist",
        destructive: true,
        onPress: async () => {
          setTracks((prev) => prev.filter((t) => t.key !== menuTrack.key));
          try {
            await removeTrack(playlistId, menuTrack.key);
          } catch {
            void loadTracks();
          }
        },
      },
    ];
    if (menuTrack.kind === "nasheed" && menuTrack.artist_id) {
      list.push({
        key: "artist",
        icon: "person-outline",
        label: "Go to artist",
        onPress: () =>
          router.push({
            pathname: "/(tabs)/nasheeds/artist/[id]",
            params: { id: menuTrack.artist_id },
          }),
      });
    }
    if (menuTrack.kind === "surah") {
      list.push({
        key: "reciter",
        icon: "person-outline",
        label: "Go to reciter",
        onPress: () =>
          router.push({
            pathname: "/(tabs)/quran/reciter/[id]",
            params: { id: menuTrack.reciter_id },
          }),
      });
    }
    return list;
  }, [menuTrack, removeTrack, playlistId, loadTracks, router]);

  const isCollectionActive = !!currentTrack?.id.startsWith(trackPrefix);
  const isCollectionPlaying = isPlaying && isCollectionActive;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<UserPlaylistTrack>) => {
      const trackId = `${trackPrefix}${item.key}`;
      const isActive = currentTrack?.id === trackId;
      return (
        <PlaylistRow
          track={item}
          trackId={trackId}
          imageUrl={artworkFor(item)}
          isActive={isActive}
          isPlaying={isPlaying && isActive}
          onPlay={onPlay}
          onMenu={setMenuTrack}
        />
      );
    },
    [trackPrefix, currentTrack?.id, artworkFor, isPlaying, onPlay],
  );

  if (hydrated && !playlist) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-qasid-black px-8">
        <Text className="text-center text-base text-white/60">
          This playlist no longer exists.
        </Text>
      </SafeAreaView>
    );
  }

  if (!playlist) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-qasid-black">
        <ActivityIndicator color={GOLD} />
      </SafeAreaView>
    );
  }

  const header = (
    <View className="pt-6">
      <View className="flex-row items-center">
        <View
          className="mr-4"
          style={{
            shadowColor: GOLD,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
          }}
        >
          <PlaylistCover playlist={playlist} size={HEADER_COVER_SIZE} />
        </View>
        <View className="flex-1">
          <Text className="mb-1 text-2xl font-bold text-qasid-white">
            {playlist.title}
          </Text>
          <Text className="text-sm text-qasid-white/70">
            {playlist.track_count === 1
              ? "1 track"
              : `${playlist.track_count} tracks`}
          </Text>
        </View>
      </View>
      {!!playlist.description && (
        <Text className="mt-6 text-qasid-white">{playlist.description}</Text>
      )}
      {playable.length > 0 && (
        <View className="mt-6 flex-row items-center gap-3">
          <PlaybackModeButton
            subtitle={playlist.title}
            isCollectionActive={isCollectionActive}
            onPlayInOrder={handlePlayAll}
            onPlayShuffled={handlePlayShuffled}
          />
          <CollectionDownloadButton
            tracks={downloadTracks}
            subtitle={playlist.title}
          />
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Edit or delete playlist"
            className="items-center justify-center rounded-2xl px-4 py-3"
          >
            <Feather
              name="edit-2"
              size={HEADER_ACTION_ICON_SIZE}
              color={HEADER_ACTION_ICON_COLOR}
            />
          </TouchableOpacity>
          <PlayButton
            clasName="flex-1 ml-10"
            handlePlayAll={handlePlayAll}
            label="Play All"
            kind={PlayButtonVariant.PRIMARY}
            isPlaying={isCollectionPlaying}
          />
        </View>
      )}
      <View className="mb-4 mt-8" />
    </View>
  );

  const empty = loading ? (
    <View>
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
        <View key={`skeleton-${i}`} className="mb-1">
          <SharedCardSkeleton />
        </View>
      ))}
    </View>
  ) : (
    <View className="items-center px-6 pt-4">
      <Ionicons name="musical-notes-outline" size={36} color={GOLD} />
      <Text className="mt-3 text-center text-base text-white/70">
        {error ?? "No tracks yet."}
      </Text>
      {!error && (
        <Text className="mt-1 text-center text-[13px] text-white/45">
          Tap ⋯ on any nasheed or surah and choose “Add to playlist”, or +
          beside Play All on an artist or reciter.
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <PremiumGateModal
        visible={gateVisible}
        playsLeft={playsLeft}
        onClose={() => setGateVisible(false)}
      />
      <FlatList
        data={loading ? [] : tracks}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: viewMode === "hidden" ? 32 : 128,
        }}
        // SharedCard is absolutely-positioned gradients inside an
        // overflow-hidden container — exactly the shape iOS blanks out.
        removeClippedSubviews={Platform.OS === "android"}
        onRefresh={loadTracks}
        refreshing={false}
      />

      {menuOpen && (
        <ActionListSheet
          visible
          onClose={() => setMenuOpen(false)}
          title={playlist.title}
          subtitle="Playlist"
          actions={playlistActions}
        />
      )}
      {editOpen && (
        <PlaylistFormSheet
          visible
          onClose={() => setEditOpen(false)}
          playlist={playlist}
        />
      )}
      {menuTrack && (
        <ActionListSheet
          visible
          onClose={() => setMenuTrack(null)}
          title={menuTrack.title}
          subtitle={menuTrack.subtitle}
          actions={trackActions}
        />
      )}
    </SafeAreaView>
  );
}
