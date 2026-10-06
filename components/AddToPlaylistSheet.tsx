import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import NoImage from "../assets/images/no_image.webp";
import { GOLD } from "../constants/colors";
import { useBottomSheet } from "../hooks/useBottomSheet";
import { fetchMembership } from "../services/user-playlists-service";
import { useUserPlaylistsStore } from "../stores/userPlaylistsStore";
import { useIsPremium, useUserStore } from "../stores/userStore";
import { UserPlaylist, UserPlaylistTrackInput } from "../types/userPlaylist";
import {
  addGate,
  collectionPlaylistTitle,
  createGate,
  trackCapacity,
  trackKeyFor,
} from "../utils/user-playlists";
import { BottomSheetPanel } from "./BottomSheetPanel";
import { PlaylistCover } from "./PlaylistCover";

const ROW_COVER_SIZE = 48;
// Long enough to see the checkmark land before the sheet slides away.
const ADDED_CONFIRM_MS = 650;
const LIST_MAX_HEIGHT = 360;
const INACTIVE_ICON = "rgba(255,255,255,0.35)";
/** `busyId` while "New playlist" is creating one; real ids never clash. */
const CREATING_ID = "__creating__";

/**
 * What a playlist created from a collection's "+" is named after: the artist,
 * reciter or collection, with its image as the cover.
 */
export type CollectionPlaylistSeed = {
  title?: string;
  /** Storage path or URL of the collection's image. */
  imagePath?: string;
};

/** Where the flow continues once this sheet is gone. */
export type AddToPlaylistNext =
  | "create"
  | "premium-playlists"
  | "premium-tracks";

export type AddToPlaylistSheetProps = {
  visible: boolean;
  /**
   * The sheet has finished closing. `next` is set when the user asked for a
   * new playlist or hit a free-tier limit; the parent then presents that
   * sheet, after the iOS modal hand-off delay.
   */
  onClose: (next?: AddToPlaylistNext) => void;
  /** One track (from a `⋯` menu) or a whole artist / reciter list. */
  items: readonly UserPlaylistTrackInput[];
  /** Header line: the track title, or e.g. "All nasheeds · Artist". */
  title: string;
  /** Resolved artwork for the header. */
  image?: string;
  /**
   * Set by the "+" beside Play All: "New playlist" then creates the playlist
   * right away, named after the collection, instead of opening the form.
   */
  seed?: CollectionPlaylistSeed;
};

/**
 * The Spotify-style "Add to playlist" picker: a "New playlist" button on top,
 * then every playlist. For a single track each row carries a checkmark where
 * the track already is: tapping adds it (closing once the checkmark shows),
 * tapping a checked one takes it out again. For a list, tapping adds every
 * track not yet there, as many as still fit.
 */
export function AddToPlaylistSheet({
  visible,
  onClose,
  items,
  title,
  image,
  seed,
}: AddToPlaylistSheetProps) {
  const single = items.length === 1 ? items[0] : null;
  const insets = useSafeAreaInsets();
  const isPremium = useIsPremium();
  const planResolved = useUserStore((s) => s.planResolved);
  const playlists = useUserPlaylistsStore((s) => s.playlists);
  const hydrated = useUserPlaylistsStore((s) => s.hydrated);
  const addTrack = useUserPlaylistsStore((s) => s.addTrack);
  const addTracks = useUserPlaylistsStore((s) => s.addTracks);
  const createPlaylist = useUserPlaylistsStore((s) => s.create);
  const removeTrack = useUserPlaylistsStore((s) => s.removeTrack);

  const [members, setMembers] = useState<Set<string> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextRef = useRef<AddToPlaylistNext | undefined>(undefined);
  const handleClosed = useCallback(() => onClose(nextRef.current), [onClose]);
  const sheet = useBottomSheet({ visible, onClose: handleClosed });
  const { animateClose } = sheet;
  const closeTo = useCallback(
    (next: AddToPlaylistNext) => {
      nextRef.current = next;
      animateClose();
    },
    [animateClose],
  );

  useEffect(() => {
    void useUserPlaylistsStore
      .getState()
      .hydrate()
      .catch(() => {});
  }, []);

  // Membership of the playlists known when the sheet opened; later changes
  // are tracked locally by the taps below. A list has no single membership,
  // so its rows only show what this sheet added.
  const trackKey = single ? trackKeyFor(single) : null;
  const singleRef = useRef(single);
  singleRef.current = single;
  const playlistIdsKey = playlists.map((p) => p.id).join(",");
  useEffect(() => {
    if (!hydrated) return;
    const item = singleRef.current;
    if (!item) {
      setMembers(new Set());
      return;
    }
    let cancelled = false;
    const ids = playlistIdsKey ? playlistIdsKey.split(",") : [];
    fetchMembership(ids, item)
      .then((found) => {
        if (!cancelled) setMembers(found);
      })
      .catch(() => {
        if (!cancelled) setMembers(new Set());
      });
    return () => {
      cancelled = true;
    };
    // Keyed by the track, not by the object identity of `single`.
  }, [hydrated, playlistIdsKey, trackKey]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const markAdded = useCallback((playlistId: string) => {
    setMembers((prev) => new Set(prev).add(playlistId));
  }, []);

  const handleAddAll = useCallback(
    async (playlist: UserPlaylist) => {
      if (!planResolved) return;
      setBusyId(playlist.id);
      try {
        const { added, overflow } = await addTracks(
          playlist.id,
          items,
          trackCapacity(isPremium),
        );
        if (added > 0) markAdded(playlist.id);
        if (overflow > 0 && !isPremium) {
          // Added what fit; the upgrade sheet explains the rest.
          closeTimerRef.current = setTimeout(
            () => closeTo("premium-tracks"),
            added > 0 ? ADDED_CONFIRM_MS : 0,
          );
        } else if (overflow > 0) {
          setNotice(
            `Added ${added}. “${playlist.title}” is full, ${overflow} didn't fit.`,
          );
        } else if (added === 0) {
          setNotice(`All of these are already in “${playlist.title}”.`);
        } else {
          closeTimerRef.current = setTimeout(animateClose, ADDED_CONFIRM_MS);
        }
      } catch {
        setNotice("Couldn't add the tracks. Try again.");
      } finally {
        setBusyId(null);
      }
    },
    [
      planResolved,
      addTracks,
      items,
      isPremium,
      markAdded,
      closeTo,
      animateClose,
    ],
  );

  const seedTitle = collectionPlaylistTitle(seed?.title);
  const seedImagePath = seed?.imagePath;

  const handleNewPlaylist = useCallback(async () => {
    // Wait for RevenueCat rather than upselling a paying user after a cold start.
    if (!planResolved || busyId) return;
    const gate = createGate({ isPremium, playlistCount: playlists.length });
    if (gate === "premium") {
      closeTo("premium-playlists");
      return;
    }
    if (!seedTitle) {
      closeTo("create");
      return;
    }

    setNotice(null);
    setBusyId(CREATING_ID);
    let created: UserPlaylist;
    try {
      created = await createPlaylist({
        title: seedTitle,
        image_path: seedImagePath,
      });
    } catch {
      setNotice("Couldn't create the playlist. Try again.");
      return;
    } finally {
      setBusyId(null);
    }
    // The new playlist is already in the list; it gets its checkmark there.
    await handleAddAll(created);
  }, [
    planResolved,
    busyId,
    isPremium,
    playlists.length,
    closeTo,
    seedTitle,
    seedImagePath,
    createPlaylist,
    handleAddAll,
  ]);

  const handleToggle = useCallback(
    async (playlist: UserPlaylist) => {
      if (busyId || !members) return;
      setNotice(null);

      if (!single || !trackKey) {
        await handleAddAll(playlist);
        return;
      }

      if (members.has(playlist.id)) {
        setBusyId(playlist.id);
        try {
          await removeTrack(playlist.id, trackKey);
          setMembers((prev) => {
            const next = new Set(prev);
            next.delete(playlist.id);
            return next;
          });
        } catch {
          setNotice("Couldn't update the playlist. Try again.");
        } finally {
          setBusyId(null);
        }
        return;
      }

      if (!planResolved) return;
      const gate = addGate({ isPremium, trackCount: playlist.track_count });
      if (gate === "premium") {
        closeTo("premium-tracks");
        return;
      }
      if (gate === "full") {
        setNotice(`“${playlist.title}” is full.`);
        return;
      }

      setBusyId(playlist.id);
      try {
        await addTrack(playlist.id, single);
        markAdded(playlist.id);
        closeTimerRef.current = setTimeout(animateClose, ADDED_CONFIRM_MS);
      } catch {
        setNotice("Couldn't add the track. Try again.");
      } finally {
        setBusyId(null);
      }
    },
    [
      busyId,
      members,
      removeTrack,
      trackKey,
      single,
      handleAddAll,
      markAdded,
      planResolved,
      isPremium,
      closeTo,
      addTrack,
      animateClose,
    ],
  );

  const loading = !hydrated || members === null;

  return (
    <BottomSheetPanel
      visible={visible}
      sheet={sheet}
      header={
        <View className="flex-row items-center px-5 pb-4">
          <Image
            source={image ? { uri: image } : NoImage}
            className="h-12 w-12 rounded-md"
            resizeMode="cover"
          />
          <View className="ml-3 flex-1">
            <Text className="text-[13px] text-white/55">Add to playlist</Text>
            <Text
              className="mt-0.5 text-base font-semibold text-white"
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
        </View>
      }
    >
      <View style={{ paddingBottom: insets.bottom + 12 }} className="pt-4">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => void handleNewPlaylist()}
          disabled={busyId !== null}
          accessibilityRole="button"
          className="mx-5 flex-row items-center justify-center rounded-2xl bg-qasid-gold py-3"
        >
          {busyId === CREATING_ID ? (
            <ActivityIndicator color="#0B0B0B" />
          ) : (
            <Ionicons name="add" size={22} color="#0B0B0B" />
          )}
          <Text className="ml-2 text-base font-semibold text-qasid-black">
            New playlist
          </Text>
        </TouchableOpacity>

        {!!notice && (
          <Text className="mx-5 mt-3 text-[13px] text-white/60">{notice}</Text>
        )}

        {loading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={GOLD} />
          </View>
        ) : playlists.length === 0 ? (
          <Text className="mx-5 mt-5 mb-2 text-center text-[13px] text-white/50">
            You have no playlists yet. Create one and{" "}
            {single ? "this track goes" : "these tracks go"} straight in.
          </Text>
        ) : (
          <ScrollView
            style={{ maxHeight: LIST_MAX_HEIGHT }}
            className="mt-3"
            keyboardShouldPersistTaps="handled"
          >
            {playlists.map((playlist) => {
              const isMember = members.has(playlist.id);
              return (
                <TouchableOpacity
                  key={playlist.id}
                  activeOpacity={0.7}
                  onPress={() => void handleToggle(playlist)}
                  disabled={busyId !== null}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isMember }}
                  className="flex-row items-center px-5 py-2.5"
                >
                  <PlaylistCover
                    playlist={playlist}
                    size={ROW_COVER_SIZE}
                    rounded={8}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-base text-white" numberOfLines={1}>
                      {playlist.title}
                    </Text>
                    <Text className="mt-0.5 text-[13px] text-white/50">
                      {playlist.track_count === 1
                        ? "1 track"
                        : `${playlist.track_count} tracks`}
                    </Text>
                  </View>
                  {busyId === playlist.id ? (
                    <ActivityIndicator color={GOLD} />
                  ) : (
                    <Ionicons
                      name={
                        isMember ? "checkmark-circle" : "add-circle-outline"
                      }
                      size={26}
                      color={isMember ? GOLD : INACTIVE_ICON}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </BottomSheetPanel>
  );
}
