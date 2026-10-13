import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GOLD } from "../constants/colors";
import { useBottomSheet } from "../hooks/useBottomSheet";
import { useUserPlaylistsStore } from "../stores/userPlaylistsStore";
import { useIsPremium } from "../stores/userStore";
import { UserPlaylist, UserPlaylistTrackInput } from "../types/userPlaylist";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  trackCapacity,
  validateTitle,
} from "../utils/user-playlists";
import { BottomSheetPanel } from "./BottomSheetPanel";
import { PlaylistCover } from "./PlaylistCover";

const COVER_SIZE = 96;
const IMAGE_QUALITY = 0.8;
const PLACEHOLDER_COLOR = "rgba(255,255,255,0.35)";
// After the sheet's slide-in: focusing while the panel is still moving makes
// iOS lay the text out at the panel's start position, offset and clipped.
const FOCUS_DELAY_MS = 300;

const EMPTY_COVER: Pick<UserPlaylist, "image_path" | "cover_paths"> = {
  cover_paths: [],
};

/** Set when the sheet closed after saving. */
export type PlaylistFormResult = {
  /** Tracks of `tracksToAdd` that did not fit into the new playlist. */
  overflow: number;
};

export type PlaylistFormSheetProps = {
  visible: boolean;
  /** The sheet has finished closing; `result` is set when it saved. */
  onClose: (result?: PlaylistFormResult) => void;
  /** Edit mode when given, create mode otherwise. */
  playlist?: UserPlaylist;
  /** Create mode: added to the new playlist right after it is created. */
  tracksToAdd?: readonly UserPlaylistTrackInput[];
  /** Create mode: what is being added, shown under the heading. */
  addingLabel?: string;
};

export function PlaylistFormSheet({
  visible,
  onClose,
  playlist,
  tracksToAdd,
  addingLabel,
}: PlaylistFormSheetProps) {
  const insets = useSafeAreaInsets();
  const create = useUserPlaylistsStore((s) => s.create);
  const update = useUserPlaylistsStore((s) => s.update);
  const addTracks = useUserPlaylistsStore((s) => s.addTracks);
  const isPremium = useIsPremium();

  const [title, setTitle] = useState(playlist?.title ?? "");
  const [description, setDescription] = useState(playlist?.description ?? "");
  // undefined = unchanged, null = removed, string = newly picked local file.
  const [imageUri, setImageUri] = useState<string | null | undefined>(
    undefined,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resultRef = useRef<PlaylistFormResult | undefined>(undefined);
  const handleClosed = useCallback(() => onClose(resultRef.current), [onClose]);
  const sheet = useBottomSheet({ visible, onClose: handleClosed });
  const { animateClose } = sheet;

  const isEdit = !!playlist;

  const titleRef = useRef<TextInput>(null);
  useEffect(() => {
    if (isEdit || !visible) return;
    const timer = setTimeout(() => titleRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isEdit, visible]);
  const hasStoredImage = !!playlist?.image_path && imageUri !== null;
  const hasImage = !!imageUri || hasStoredImage;
  const coverSource =
    imageUri === null
      ? { cover_paths: playlist?.cover_paths ?? [] }
      : (playlist ?? EMPTY_COVER);

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: IMAGE_QUALITY,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (uri) setImageUri(uri);
  }, []);

  const handleRemoveImage = useCallback(() => setImageUri(null), []);

  const handleSave = useCallback(async () => {
    const validation = validateTitle(title);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const edit = { title: validation.title, description, imageUri };
      let overflow = 0;
      if (playlist) {
        await update(playlist.id, edit);
      } else {
        const created = await create(edit);
        if (tracksToAdd?.length) {
          ({ overflow } = await addTracks(
            created.id,
            tracksToAdd,
            trackCapacity(isPremium),
          ));
        }
      }
      resultRef.current = { overflow };
      animateClose();
    } catch (e) {
      console.warn("save playlist failed", e);
      setError(
        "Couldn't save the playlist. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    title,
    description,
    imageUri,
    playlist,
    update,
    create,
    tracksToAdd,
    addTracks,
    isPremium,
    animateClose,
  ]);

  return (
    <BottomSheetPanel
      visible={visible}
      sheet={sheet}
      header={
        <View className="px-5 pb-4">
          <Text className="text-base font-semibold text-white">
            {isEdit ? "Edit playlist" : "New playlist"}
          </Text>
          {!!addingLabel && (
            <Text
              className="mt-0.5 text-[13px] text-white/55"
              numberOfLines={1}
            >
              {`With ${addingLabel}`}
            </Text>
          )}
        </View>
      }
    >
      <View style={{ paddingBottom: insets.bottom + 12 }} className="p-5">
        <View className="flex-row items-center">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePickImage}
            accessibilityRole="button"
            accessibilityLabel="Choose playlist image"
          >
            <PlaylistCover
              playlist={coverSource}
              size={COVER_SIZE}
              localImageUri={imageUri}
            />
            <View className="absolute bottom-1 right-1 h-7 w-7 items-center justify-center rounded-full bg-qasid-black/80">
              <Ionicons name="camera" size={15} color={GOLD} />
            </View>
          </TouchableOpacity>

          <View className="ml-4 flex-1">
            <TouchableOpacity activeOpacity={0.7} onPress={handlePickImage}>
              <Text className="text-[15px] text-qasid-gold">
                {hasImage ? "Change image" : "Choose image"}
              </Text>
            </TouchableOpacity>
            {hasImage && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleRemoveImage}
                className="mt-3"
              >
                <Text className="text-[15px] text-white/60">Remove image</Text>
              </TouchableOpacity>
            )}
            {!hasImage && (
              <Text className="mt-1 text-[12px] leading-4 text-white/40">
                Without one, the covers of the first tracks are used.
              </Text>
            )}
          </View>
        </View>

        {/* The border lives on a wrapper, as on the profile screen: on the
            TextInput itself iOS insets and clips the text. */}
        <View className="mt-6 rounded-xl border border-white/15">
          <TextInput
            ref={titleRef}
            value={title}
            onChangeText={setTitle}
            placeholder="Playlist name"
            placeholderTextColor={PLACEHOLDER_COLOR}
            maxLength={MAX_TITLE_LENGTH}
            returnKeyType="done"
            onSubmitEditing={handleSave}
            selectionColor={GOLD}
            // `text-[16px]`, not `text-base`: that also sets a lineHeight,
            // which pushes single-line iOS text below the centre. With a
            // fixed height and no vertical padding iOS centres it itself.
            className="h-12 px-4 text-[16px] text-white"
          />
        </View>
        <View className="mt-3 rounded-xl border border-white/15">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            placeholderTextColor={PLACEHOLDER_COLOR}
            maxLength={MAX_DESCRIPTION_LENGTH}
            multiline
            textAlignVertical="top"
            selectionColor={GOLD}
            className="max-h-28 min-h-12 px-4 py-3.5 text-[16px] text-white"
          />
        </View>

        {!!error && (
          <Text className="mt-3 text-[13px] text-qasid-red">{error}</Text>
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSave}
          disabled={saving}
          className="mt-6 items-center justify-center rounded-2xl bg-qasid-gold py-3"
        >
          {saving ? (
            <ActivityIndicator color="#0B0B0B" />
          ) : (
            <Text className="text-base font-semibold text-qasid-black">
              {isEdit ? "Save" : "Create"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheetPanel>
  );
}
