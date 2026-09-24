import { useCallback, useMemo } from "react";
import {
  Alert,
  Animated,
  Image,
  Modal,
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
import { useBottomSheet } from "../hooks/useBottomSheet";
import { useDownload } from "../hooks/useDownload";
// TEMP admin curation hotfix — remove with PlaylistPickerModal.
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useFavoritesStore, useIsFavorite } from "../stores/favoritesStore";
import { shareTrack } from "../services/share-service";

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
  /**
   * Raised instead of downloading when the user is not premium. The parent owns
   * the upgrade sheet, because this one is gone by the time it opens.
   */
  onRequirePremium?: () => void;
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
  onRequirePremium,
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
  const { status, progress, download, remove, isPremium, planResolved } =
    useDownload(downloadTarget);

  const {
    translateY,
    backdropOpacity,
    panHandlers,
    onPanelLayout,
    animateClose,
    closeThen,
  } = useBottomSheet({ visible, onClose });

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
    // Wait for RevenueCat rather than guessing — a tap right after a cold start
    // would otherwise show a paying user the paywall.
    if (!planResolved) return;

    if (!isPremium) {
      // Hands off to the parent's PremiumRequiredSheet, so a free user gets the
      // app's own panel here too instead of a system alert.
      if (onRequirePremium) closeThen(onRequirePremium);
      return;
    }

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
  }, [
    planResolved,
    isPremium,
    onRequirePremium,
    closeThen,
    status,
    remove,
    download,
  ]);

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
          onLayout={onPanelLayout}
        >
          <View className="relative overflow-hidden rounded-t-3xl">
            <View className="absolute inset-0 bg-qasid-bg-2" />
            <View className="absolute inset-0 rounded-t-3xl border-t border-x border-qasid-gold/30" />

            <View {...panHandlers}>
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
