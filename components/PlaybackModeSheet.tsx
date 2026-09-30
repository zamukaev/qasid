import { useCallback } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GOLD } from "../constants/colors";
import { RepeatMode, useAudioPlayer } from "../context/AudioPlayerContext";
import { useBottomSheet } from "../hooks/useBottomSheet";

const INACTIVE_ICON = "rgba(255,255,255,0.35)";

type ModeOption = {
  mode: RepeatMode;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint: string;
};

// Same order and icons as the full-screen player's mode row, so the two places
// that set the mode read as one control rather than two different ones.
const MODE_OPTIONS: readonly ModeOption[] = [
  {
    mode: "repeat-one",
    icon: "repeat",
    label: "Repeat one",
    hint: "Keep replaying a single track",
  },
  {
    mode: "sequential",
    icon: "list",
    label: "Play in order",
    hint: "Follow the list from the top",
  },
  {
    mode: "shuffle",
    icon: "shuffle",
    label: "Shuffle",
    hint: "Start anywhere, in a mixed order",
  },
];

export type PlaybackModeSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The collection's name, shown under the heading. */
  subtitle?: string;
  /**
   * Whether this collection is the one loaded in the player — paused counts.
   * Picking a mode then only switches it instead of restarting playback.
   */
  isCollectionActive: boolean;
  /** Starts the collection at its first track. */
  onPlayInOrder: () => void;
  /** Starts the collection at a random track. */
  onPlayShuffled: () => void;
};

export function PlaybackModeSheet({
  visible,
  onClose,
  subtitle,
  isCollectionActive,
  onPlayInOrder,
  onPlayShuffled,
}: PlaybackModeSheetProps) {
  const insets = useSafeAreaInsets();
  const { repeatMode, setRepeatMode } = useAudioPlayer();

  const {
    translateY,
    backdropOpacity,
    panHandlers,
    onPanelLayout,
    animateClose,
    closeThen,
  } = useBottomSheet({ visible, onClose });

  const handleSelect = useCallback(
    (mode: RepeatMode) => {
      if (isCollectionActive) {
        // Already playing: setRepeatMode reorders the live queue around the
        // current track, so the mode changes without the audio breaking off.
        setRepeatMode(mode);
        animateClose();
        return;
      }

      // Nothing of this collection is loaded, so the queue is about to be
      // replaced wholesale — reordering the old one first would only race it.
      // The mode is still set first: setQueue reads it synchronously and hands
      // RNTP an already-shuffled queue.
      setRepeatMode(mode, { reorder: false });
      // closeThen, not animateClose: starting playback can raise the free-tier
      // gate or an unavailable-track alert, which iOS drops mid-dismissal.
      closeThen(mode === "shuffle" ? onPlayShuffled : onPlayInOrder);
    },
    [
      isCollectionActive,
      setRepeatMode,
      animateClose,
      closeThen,
      onPlayShuffled,
      onPlayInOrder,
    ],
  );

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
            <View className="absolute inset-0 rounded-t-3xl border-x border-t border-qasid-gold/30" />

            <View {...panHandlers}>
              <View className="items-center pb-2 pt-3">
                <View className="h-1 w-10 rounded-full bg-white/25" />
              </View>

              <View className="px-5 pb-4">
                <Text className="text-base font-semibold text-white">
                  Playback
                </Text>
                {!!subtitle && (
                  <Text
                    className="mt-0.5 text-[13px] text-white/55"
                    numberOfLines={1}
                  >
                    {subtitle}
                  </Text>
                )}
              </View>
            </View>

            <View className="h-px bg-white/10" />

            <View
              style={{ paddingBottom: insets.bottom + 12 }}
              className="pt-2"
            >
              {MODE_OPTIONS.map((option) => {
                const active = repeatMode === option.mode;
                return (
                  <TouchableOpacity
                    key={option.mode}
                    activeOpacity={0.7}
                    onPress={() => handleSelect(option.mode)}
                    className="flex-row items-center px-5 py-4"
                  >
                    <Feather
                      name={option.icon}
                      size={22}
                      color={active ? GOLD : INACTIVE_ICON}
                    />
                    <View className="ml-4 flex-1">
                      <Text
                        className={`text-base ${
                          active ? "text-qasid-gold" : "text-white"
                        }`}
                      >
                        {option.label}
                      </Text>
                      <Text className="mt-0.5 text-[13px] text-white/45">
                        {option.hint}
                      </Text>
                    </View>
                    {active && (
                      <Ionicons name="checkmark" size={20} color={GOLD} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
