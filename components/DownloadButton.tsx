import React from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { GOLD } from "../constants/colors";
import { Track } from "../context/AudioPlayerContext";
import { useDownload } from "../hooks/useDownload";

type Props = { track: Track };

export function DownloadButton({ track }: Props) {
  const { status, progress, download, remove } = useDownload(track);

  const handlePress = () => {
    if (status === "downloaded") {
      Alert.alert(
        "Remove Download",
        "Remove this track from offline storage?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: remove },
        ],
      );
    } else if (status === "idle") {
      download();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{ padding: 6 }}
    >
      {status === "downloading" ? (
        <View
          style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: GOLD, fontSize: 10, fontWeight: "700" }}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      ) : status === "downloaded" ? (
        <Feather name="check-circle" size={22} color={GOLD} />
      ) : (
        <Feather name="download-cloud" size={22} color="rgba(255,255,255,0.35)" />
      )}
    </TouchableOpacity>
  );
}
