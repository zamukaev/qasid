import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBottomSheet } from "../hooks/useBottomSheet";
import { BottomSheetPanel } from "./BottomSheetPanel";

const ICON_COLOR = "rgba(255,255,255,0.35)";
const DESTRUCTIVE_COLOR = "#FF4444";

export type ActionListItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Runs once the sheet is gone, so it may raise an Alert or navigate. */
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: ActionListItem[];
};

/** A titled list of actions in the app's bottom-sheet style. */
export function ActionListSheet({
  visible,
  onClose,
  title,
  subtitle,
  actions,
}: Props) {
  const insets = useSafeAreaInsets();
  const sheet = useBottomSheet({ visible, onClose });

  return (
    <BottomSheetPanel
      visible={visible}
      sheet={sheet}
      header={
        <View className="px-5 pb-4">
          <Text
            className="text-base font-semibold text-white"
            numberOfLines={1}
          >
            {title}
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
      }
    >
      <View style={{ paddingBottom: insets.bottom + 12 }} className="pt-2">
        {actions.map((action) => (
          <TouchableOpacity
            key={action.key}
            activeOpacity={0.7}
            onPress={() => sheet.closeThen(action.onPress)}
            className="flex-row items-center px-5 py-4"
          >
            <Ionicons
              name={action.icon}
              size={22}
              color={action.destructive ? DESTRUCTIVE_COLOR : ICON_COLOR}
            />
            <Text
              className={`ml-4 text-base ${
                action.destructive ? "text-qasid-red" : "text-white"
              }`}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </BottomSheetPanel>
  );
}
