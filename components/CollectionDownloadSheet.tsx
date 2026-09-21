import { useMemo } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GOLD } from "../constants/colors";
import { CollectionDownload } from "../hooks/useCollectionDownload";
import { useBottomSheet } from "../hooks/useBottomSheet";
import { PremiumRequiredSheet } from "./PremiumRequiredSheet";

const DESTRUCTIVE = "#F87171";

/** "1 surahs" reads wrong, and every noun this takes is a plain -s plural. */
function plural(count: number, noun: string): string {
  if (count !== 1) return noun;
  return noun.endsWith("s") ? noun.slice(0, -1) : noun;
}

type SheetContent = {
  icon: keyof typeof Feather.glyphMap;
  heading: string;
  body: string;
  /** Absent while the subscription is still being checked. */
  action?: { label: string; onPress: () => void; destructive?: boolean };
  dismissLabel: string;
};

export type CollectionDownloadSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The collection's name, shown under the heading. */
  subtitle?: string;
  itemNoun: string;
  download: CollectionDownload;
};

/**
 * Everything the collection download asks before it acts: the paywall for free
 * users, the confirmation for premium ones, and stopping or removing an
 * existing download. A sheet rather than an Alert so it matches the shuffle
 * button sitting next to it.
 */
export function CollectionDownloadSheet({
  visible,
  onClose,
  subtitle,
  itemNoun,
  download,
}: CollectionDownloadSheetProps) {
  const insets = useSafeAreaInsets();

  const {
    translateY,
    backdropOpacity,
    panHandlers,
    onPanelLayout,
    animateClose,
  } = useBottomSheet({ visible, onClose });

  const {
    status,
    pendingCount,
    downloadedCount,
    total,
    planResolved,
    isPremium,
    startDownload,
    cancel,
    removeAll,
  } = download;

  const content = useMemo<SheetContent>(() => {
    if (!planResolved) {
      return {
        icon: "loader",
        heading: "One moment",
        body: "Checking your subscription…",
        dismissLabel: "Close",
      };
    }

    if (status === "downloading") {
      return {
        icon: "download",
        heading: "Downloading…",
        body: `${downloadedCount} of ${total} ${itemNoun} done. Stopping keeps what has already been saved.`,
        action: {
          label: "Stop download",
          onPress: () => {
            cancel();
            animateClose();
          },
          destructive: true,
        },
        dismissLabel: "Keep downloading",
      };
    }

    if (status === "downloaded") {
      return {
        icon: "check-circle",
        heading: "Saved on this device",
        body: `All ${total} ${itemNoun} are available offline.`,
        action: {
          label: "Remove downloads",
          onPress: () => {
            removeAll();
            animateClose();
          },
          destructive: true,
        },
        dismissLabel: "Cancel",
      };
    }

    return {
      icon: "download",
      heading: `Download ${pendingCount} ${plural(pendingCount, itemNoun)}?`,
      body:
        downloadedCount > 0
          ? `${downloadedCount} already saved. This may use a lot of storage and mobile data.`
          : "This may use a lot of storage and mobile data.",
      action: {
        label: "Download",
        onPress: () => {
          startDownload();
          animateClose();
        },
      },
      dismissLabel: "Cancel",
    };
  }, [
    planResolved,
    status,
    pendingCount,
    downloadedCount,
    total,
    itemNoun,
    startDownload,
    cancel,
    removeAll,
    animateClose,
  ]);

  // One shared panel for the upgrade prompt, so a free user sees the same thing
  // here and in the `⋯` menu's download row.
  if (planResolved && !isPremium) {
    return (
      <PremiumRequiredSheet
        visible={visible}
        onClose={onClose}
        subtitle={subtitle}
      />
    );
  }

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
                  Offline
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

            <View style={{ paddingBottom: insets.bottom + 12 }} className="p-5">
              <View className="flex-row items-start">
                <Feather name={content.icon} size={22} color={GOLD} />
                <View className="ml-4 flex-1">
                  <Text className="text-base font-semibold text-white">
                    {content.heading}
                  </Text>
                  <Text className="mt-1 text-[13px] leading-5 text-white/55">
                    {content.body}
                  </Text>
                </View>
              </View>

              {content.action && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={content.action.onPress}
                  className={`mt-6 items-center justify-center rounded-2xl py-3 ${
                    content.action.destructive
                      ? "border border-red-400/60"
                      : "bg-qasid-gold"
                  }`}
                >
                  <Text
                    className="text-base font-semibold"
                    style={{
                      color: content.action.destructive ? DESTRUCTIVE : "#000",
                    }}
                  >
                    {content.action.label}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={animateClose}
                className="mt-3 items-center justify-center py-3"
              >
                <Text className="text-base text-white/60">
                  {content.dismissLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
