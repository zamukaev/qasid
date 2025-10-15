import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "../context/AudioPlayerContext";

export default function MiniPlayer() {
  const { currentTrack, isPlaying, togglePlayPause, setViewMode } =
    useAudioPlayer();

  if (!currentTrack) return null;

  return (
    <Pressable
      onPress={() => {
        setViewMode("full");
      }}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        backgroundColor: "rgba(28, 28, 28, 0.95)",
        borderTopWidth: 1,
        borderTopColor: "rgba(231, 193, 28, 0.2)",
        paddingVertical: 10,
        paddingHorizontal: 14,
        bottom: 56,
        zIndex: 50,
        elevation: 50,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text
            numberOfLines={1}
            style={{
              color: "#E7C11C",
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {currentTrack.title}
          </Text>
          {currentTrack.artist ? (
            <Text
              numberOfLines={1}
              style={{
                color: "rgba(231, 193, 28, 0.7)",
                fontSize: 12,
                marginTop: 2,
              }}
            >
              {currentTrack.artist}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={togglePlayPause} hitSlop={10}>
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={22}
            color="#E7C11C"
          />
        </Pressable>
      </View>
    </Pressable>
  );
}
