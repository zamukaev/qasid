import React from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { BottomSheetControls } from "../hooks/useBottomSheet";

type Props = {
  visible: boolean;
  sheet: BottomSheetControls;
  /** Draggable top part (below the grab handle): title, artwork. */
  header: React.ReactNode;
  children: React.ReactNode;
};

/**
 * The modal, backdrop and gold-rimmed panel of the app's bottom sheets (see
 * TrackActionsSheet), shared by the playlist sheets. The panel rides up with
 * the keyboard, for the ones that hold a form.
 */
export function BottomSheetPanel({ visible, sheet, header, children }: Props) {
  const {
    translateY,
    backdropOpacity,
    panHandlers,
    onPanelLayout,
    animateClose,
  } = sheet;

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
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
              {header}
            </View>

            <View className="h-px bg-white/10" />
            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
