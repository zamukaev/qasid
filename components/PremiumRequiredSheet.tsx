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
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GOLD } from "../constants/colors";
import { useBottomSheet } from "../hooks/useBottomSheet";

export const OFFLINE_PREMIUM_PITCH =
  "Offline listening is a premium feature. Upgrade to save to your device and play without a connection.";

export type PremiumRequiredSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** What is being gated — the track or collection name. */
  subtitle?: string;
  /** Defaults to the offline-listening pitch. */
  body?: string;
};

/**
 * The one place the app asks for an upgrade from a sheet. Used both by the
 * collection download and by the `⋯` menu's download row, so a free user gets
 * the same panel wherever they hit the gate — not a system alert in one place
 * and a sheet in the other.
 */
export function PremiumRequiredSheet({
  visible,
  onClose,
  subtitle,
  body = OFFLINE_PREMIUM_PITCH,
}: PremiumRequiredSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    translateY,
    backdropOpacity,
    panHandlers,
    onPanelLayout,
    animateClose,
    closeThen,
  } = useBottomSheet({ visible, onClose });

  const handleUpgrade = useCallback(() => {
    // closeThen, not animateClose: the premium screen is a navigation that iOS
    // drops while this sheet is still dismissing.
    closeThen(() => router.push("/settings/premium"));
  }, [closeThen, router]);

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
                <Feather name="lock" size={22} color={GOLD} />
                <View className="ml-4 flex-1">
                  <Text className="text-base font-semibold text-white">
                    Premium required
                  </Text>
                  <Text className="mt-1 text-[13px] leading-5 text-white/55">
                    {body}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleUpgrade}
                className="mt-6 items-center justify-center rounded-2xl bg-qasid-gold py-3"
              >
                <Text className="text-base font-semibold text-qasid-black">
                  Get Premium
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={animateClose}
                className="mt-3 items-center justify-center py-3"
              >
                <Text className="text-base text-white/60">Not now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
