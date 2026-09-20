import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import NoImage from "../assets/images/no_image.webp";
import { GOLD } from "../constants/colors";
import { buildNasheedShareUrl } from "../constants/links";
import { Track } from "../context/AudioPlayerContext";
import { Nasheed } from "../types/nasheed";
import { useDownload } from "../hooks/useDownload";
// TEMP admin curation hotfix — remove with PlaylistPickerModal.
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useFavoritesStore, useIsFavorite } from "../stores/favoritesStore";
import { shareTrack } from "../services/share-service";

const OPEN_DURATION_MS = 220;
const CLOSE_DURATION_MS = 180;
// Drag far enough (or fast enough) and the release closes instead of springing back.
const DISMISS_TRAVEL_RATIO = 0.25;
const DISMISS_VELOCITY = 0.6;
// A drag only starts once the finger has clearly committed to a vertical swipe.
const DRAG_ACTIVATION_PX = 6;
// Tall enough to cover the sheet before it is measured, so the first frame of the
// open animation starts off-screen rather than flashing the panel in place.
const INITIAL_PANEL_HEIGHT = 600;
const DIM_OPACITY = 0.7;
// iOS silently drops an Alert or a second Modal presented while this one is
// still being dismissed, so a follow-up action waits out the unmount commit.
const MODAL_HANDOFF_MS = 120;
const INACTIVE_ICON = "rgba(255,255,255,0.35)";

type SheetAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Gold, for a state that is already on (favorited, downloaded). */
  tinted?: boolean;
};

export type TrackActionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  image?: string;
  /**
   * Absent for Quran surahs — favorites are nasheed-scoped, so the favorite,
   * artist and admin rows are all hidden without one.
   */
  nasheed?: Nasheed;
  /** Absent when the row has no audio yet — the download row is then hidden. */
  track?: Track;
  /**
   * Universal Link to share. Derived from `nasheed` when omitted; Quran rows
   * pass their own, because a surah is addressed by reciter and number.
   */
  shareUrl?: string;
  /** Hidden when the sheet is opened from that artist's own screen. */
  showGoToArtist?: boolean;
  /** Admin curation, supplied only by screens that own a PlaylistPickerModal. */
  onAddToPlaylist?: (nasheed: Nasheed) => void;
};

export function TrackActionsSheet({
  visible,
  onClose,
  title,
  subtitle,
  image,
  nasheed,
  track,
  shareUrl,
  showGoToArtist = false,
  onAddToPlaylist,
}: TrackActionsSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const favorited = useIsFavorite(nasheed?.id ?? "");
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isAdmin = useIsAdmin();

  // `useDownload` is a hook, so it cannot be called conditionally. A placeholder
  // id keeps it inert for rows without audio; the row below is hidden anyway.
  const downloadTarget = useMemo<Track>(
    () => track ?? { id: "__none__", title, uri: null },
    [track, title],
  );
  const { status, progress, download, remove } = useDownload(downloadTarget);

  /** Action to run once the sheet is fully gone — see MODAL_HANDOFF_MS. */
  const pendingActionRef = useRef<(() => void) | null>(null);
  const translateY = useRef(new Animated.Value(INITIAL_PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelHeightRef = useRef(INITIAL_PANEL_HEIGHT);

  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: panelHeightRef.current,
        duration: CLOSE_DURATION_MS,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: CLOSE_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      onClose();
      const pending = pendingActionRef.current;
      pendingActionRef.current = null;
      if (pending) setTimeout(pending, MODAL_HANDOFF_MS);
    });
  }, [translateY, backdropOpacity, onClose]);

  const closeThen = useCallback(
    (action: () => void) => {
      pendingActionRef.current = action;
      animateClose();
    },
    [animateClose],
  );

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(panelHeightRef.current);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: OPEN_DURATION_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: DIM_OPACITY,
        duration: OPEN_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateY, backdropOpacity]);

  // Core RN rather than react-native-gesture-handler: no GestureHandlerRootView
  // is mounted in this app, so its gestures would silently never fire.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          gesture.dy > DRAG_ACTIVATION_PX &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_evt, gesture) => {
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_evt, gesture) => {
          const past =
            gesture.dy > panelHeightRef.current * DISMISS_TRAVEL_RATIO;
          if (past || gesture.vy > DISMISS_VELOCITY) {
            animateClose();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [translateY, animateClose],
  );

  const handleShare = useCallback(() => {
    const url = shareUrl ?? (nasheed ? buildNasheedShareUrl(nasheed.id) : null);
    // Closed first: the OS share sheet is another presented modal, and iOS
    // drops one raised while this sheet is still dismissing.
    closeThen(() => void shareTrack(title, subtitle, url));
  }, [closeThen, title, subtitle, shareUrl, nasheed]);

  const handleFavorite = useCallback(() => {
    if (!nasheed) return;
    // The store toggles optimistically and ignores taps while its own write is
    // in flight, so the sheet can close straight away.
    void toggleFavorite(nasheed);
    animateClose();
  }, [nasheed, toggleFavorite, animateClose]);

  // Deliberately leaves the sheet open: `useDownload`'s state lives here, so
  // closing would hide the progress the row is showing. The label walks
  // Download → Downloading n% → Remove download in place instead.
  const handleDownload = useCallback(() => {
    if (status === "downloaded") {
      Alert.alert(
        "Remove Download",
        "Remove this track from offline storage?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: remove },
        ],
      );
      return;
    }
    // Not awaited: the progress and the non-premium alert both live in the
    // hook, and the row must stay responsive during the transfer.
    if (status === "idle") void download();
  }, [status, remove, download]);

  const handleGoToArtist = useCallback(() => {
    const artistId = nasheed?.artist_id;
    if (!artistId) return;
    closeThen(() =>
      router.push({
        pathname: "/(tabs)/nasheeds/artist/[id]",
        params: { id: artistId },
      }),
    );
  }, [nasheed?.artist_id, closeThen, router]);

  const handleAddToPlaylist = useCallback(() => {
    if (!nasheed || !onAddToPlaylist) return;
    closeThen(() => onAddToPlaylist(nasheed));
  }, [nasheed, onAddToPlaylist, closeThen]);

  const actions = useMemo(() => {
    // Share leads, and is the one row every track has — surahs included.
    const list: SheetAction[] = [
      {
        key: "share",
        icon: "share-outline",
        label: "Share",
        onPress: handleShare,
      },
    ];

    if (nasheed) {
      list.push({
        key: "favorite",
        icon: favorited ? "heart" : "heart-outline",
        label: favorited ? "Remove from Favorites" : "Add to Favorites",
        onPress: handleFavorite,
        tinted: favorited,
      });
    }

    if (track?.uri) {
      list.push({
        key: "download",
        icon:
          status === "downloaded"
            ? "checkmark-circle"
            : status === "downloading"
              ? "cloud-download"
              : "cloud-download-outline",
        label:
          status === "downloaded"
            ? "Remove download"
            : status === "downloading"
              ? `Downloading ${Math.round(progress * 100)}%`
              : "Download",
        onPress: handleDownload,
        disabled: status === "downloading",
        tinted: status === "downloaded",
      });
    }

    if (showGoToArtist && nasheed?.artist_id) {
      list.push({
        key: "artist",
        icon: "person-outline",
        label: "Go to artist",
        onPress: handleGoToArtist,
      });
    }

    // TEMP admin curation hotfix — remove with PlaylistPickerModal.
    if (nasheed && onAddToPlaylist && isAdmin) {
      list.push({
        key: "playlist",
        icon: nasheed.playlist_id ? "add-circle" : "add-circle-outline",
        label: "Add to playlist",
        onPress: handleAddToPlaylist,
        tinted: !!nasheed.playlist_id,
      });
    }

    return list;
  }, [
    handleShare,
    nasheed,
    favorited,
    handleFavorite,
    track?.uri,
    status,
    progress,
    handleDownload,
    showGoToArtist,
    handleGoToArtist,
    onAddToPlaylist,
    isAdmin,
    handleAddToPlaylist,
  ]);

  return (
    <Modal
      visible={visible}
      transparent
      // The panel drives its own slide-in, so the platform animation would
      // double up on it.
      animationType="none"
      onRequestClose={animateClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end">
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "#000", opacity: backdropOpacity },
          ]}
        >
          <Pressable className="flex-1" onPress={animateClose} />
        </Animated.View>

        <Animated.View
          style={{ transform: [{ translateY }] }}
          onLayout={(e) => {
            panelHeightRef.current = e.nativeEvent.layout.height;
          }}
        >
          <View className="relative overflow-hidden rounded-t-3xl">
            <View className="absolute inset-0 bg-qasid-bg-2" />
            <View className="absolute inset-0 rounded-t-3xl border-t border-x border-qasid-gold/30" />

            <View {...panResponder.panHandlers}>
              <View className="pt-3 pb-2 items-center">
                <View className="h-1 w-10 rounded-full bg-white/25" />
              </View>

              <View className="flex-row items-center px-5 pb-4">
                <Image
                  source={image ? { uri: image } : NoImage}
                  className="h-12 w-12 rounded-md"
                  resizeMode="cover"
                />
                <View className="ml-3 flex-1">
                  <Text
                    className="text-white text-base font-semibold"
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                  {!!subtitle && (
                    <Text
                      className="text-white/55 text-[13px] mt-0.5"
                      numberOfLines={1}
                    >
                      {subtitle}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View className="h-px bg-white/10" />

            <View
              style={{ paddingBottom: insets.bottom + 12 }}
              className="pt-2"
            >
              {actions.map((action) => (
                <TouchableOpacity
                  key={action.key}
                  activeOpacity={0.7}
                  disabled={action.disabled}
                  onPress={action.onPress}
                  className="flex-row items-center px-5 py-4"
                >
                  <Ionicons
                    name={action.icon}
                    size={22}
                    color={action.tinted ? GOLD : INACTIVE_ICON}
                  />
                  <Text
                    className={`ml-4 text-base ${
                      action.tinted ? "text-qasid-gold" : "text-white"
                    } ${action.disabled ? "opacity-60" : ""}`}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
