// TEMP admin curation hotfix — remove with AdminPlaylistButton.
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GOLD } from "../constants/colors";
import { Nasheed, Playlist } from "../types/nasheed";
import {
  fetchPlaylists,
  setNasheedPlaylist,
} from "../services/playlists-service";

interface Props {
  visible: boolean;
  nasheed: Nasheed | null;
  onClose: () => void;
  onPlaylistChange: (nasheedId: string, playlistId: string | null) => void;
}

// A nasheed carries a single `playlist_id`, so this is a radio list: tapping a
// row assigns it, tapping the assigned row again clears it.
export function PlaylistPickerModal({
  visible,
  nasheed,
  onClose,
  onPlaylistChange,
}: Props) {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Mirrors the nasheed's stored value so the checkmark reacts instantly.
  const [selected, setSelected] = useState<string | null>(null);

  const loadPlaylists = useCallback(async () => {
    setLoadError(null);
    try {
      setPlaylists(await fetchPlaylists());
    } catch {
      setLoadError("Could not load playlists.");
    }
  }, []);

  // Fetched once on first open and kept — the playlist set barely changes, and
  // refetching on every open would stall the sheet on each tap.
  useEffect(() => {
    if (!visible || playlists !== null) return;
    void loadPlaylists();
  }, [visible, playlists, loadPlaylists]);

  useEffect(() => {
    setSelected(nasheed?.playlist_id ?? null);
    setSaveError(null);
  }, [nasheed?.id, nasheed?.playlist_id]);

  const handleSelect = async (playlistId: string) => {
    if (!nasheed || saving) return;

    const previous = selected;
    const next = previous === playlistId ? null : playlistId;

    setSelected(next);
    setSaveError(null);
    setSaving(true);
    try {
      await setNasheedPlaylist(nasheed.id, next);
      onPlaylistChange(nasheed.id, next);
    } catch {
      setSelected(previous);
      setSaveError("Save failed — check your admin permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/70 px-6"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm"
        >
          <View className="relative overflow-hidden rounded-3xl">
            <View className="absolute inset-0 bg-qasid-bg-2" />
            <View className="absolute inset-0 rounded-3xl border border-qasid-gold/30" />

            <View className="p-6">
              <Text className="text-white text-xl font-bold">
                Add to playlist
              </Text>
              <Text
                className="text-white/60 text-sm mt-1"
                numberOfLines={2}
              >
                {nasheed?.title_en ?? ""}
              </Text>

              <View className="mt-5">
                {loadError ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => void loadPlaylists()}
                    className="py-6 items-center"
                  >
                    <Text className="text-white/60 text-sm">{loadError}</Text>
                    <Text className="text-qasid-gold text-sm mt-1">
                      Tap to retry
                    </Text>
                  </TouchableOpacity>
                ) : playlists === null ? (
                  <View className="py-6 items-center">
                    <ActivityIndicator color={GOLD} />
                  </View>
                ) : playlists.length === 0 ? (
                  <Text className="text-white/60 text-sm py-6 text-center">
                    No active playlists found.
                  </Text>
                ) : (
                  <ScrollView
                    className="max-h-80"
                    showsVerticalScrollIndicator={false}
                  >
                    {playlists.map((playlist) => {
                      const isSelected = selected === playlist.id;
                      return (
                        <TouchableOpacity
                          key={playlist.id}
                          activeOpacity={0.7}
                          disabled={saving}
                          onPress={() => void handleSelect(playlist.id)}
                          className="flex-row items-center py-3"
                        >
                          <Ionicons
                            name={
                              isSelected
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            size={22}
                            color={isSelected ? GOLD : "rgba(255,255,255,0.35)"}
                          />
                          <Text
                            className={`ml-3 flex-1 text-base ${
                              isSelected ? "text-qasid-gold" : "text-white"
                            }`}
                            numberOfLines={1}
                          >
                            {playlist.name_en}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {saveError && (
                <Text className="text-qasid-red text-sm mt-3">{saveError}</Text>
              )}

              <TouchableOpacity activeOpacity={0.7} onPress={onClose}>
                <View className="py-3 items-center mt-2">
                  <Text className="text-white/40 text-sm">Done</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
