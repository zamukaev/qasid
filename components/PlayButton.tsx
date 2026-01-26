import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity } from "react-native";

export enum PlayButtonVariant {
  PRIMARY = "PRIMARY",
  SECONDARY = "SECONDARY",
}

interface PlayButtonProps {
  handlePlayAll: () => void;
  label: string;
  clasName?: string;
  kind?: PlayButtonVariant;
  isPlaying?: boolean;
}

export const PlayButton = ({
  handlePlayAll,
  label,
  clasName,
  kind = PlayButtonVariant.PRIMARY,
  isPlaying = false,
}: PlayButtonProps) => {
  return (
    <TouchableOpacity
      className={`${kind === PlayButtonVariant.PRIMARY ? "bg-qasid-gold" : "border border-qasid-gold"} rounded-2xl py-3 items-center justify-center flex-row ${clasName}`}
      onPress={handlePlayAll}
    >
      <Text
        className={`${kind === PlayButtonVariant.PRIMARY ? "text-qasid-black" : "text-qasid-gold"} font-semibold text-base`}
      >
        {label}
      </Text>
      <Ionicons
        name={isPlaying ? "pause" : "play"}
        size={16}
        color={kind === PlayButtonVariant.PRIMARY ? "#000000" : "#E7C11C"}
        style={{ marginLeft: 8 }}
      />
    </TouchableOpacity>
  );
};
