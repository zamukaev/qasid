import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "../context/AudioPlayerContext";

export default function NowPlayingBar() {
  const { currentTrack, isPlaying, togglePlayPause, setViewMode } =
    useAudioPlayer();
  if (!currentTrack) return null;

  return (
    <Pressable
      onPress={() => {
        setViewMode("full");
      }}
      style={{
        backgroundColor: "rgba(28, 28, 28, 0.98)",
        position: "absolute",
        left: 0,
        right: 0,
        paddingVertical: 12,
        paddingHorizontal: 16,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: -2 },
        elevation: 6,
        bottom: 80, // Прямо над таб-баром
        zIndex: 100,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderTopColor: "rgba(231, 193, 28, 0.2)",
        borderBottomColor: "rgba(231, 193, 28, 0.2)",
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
        <Pressable onPress={togglePlayPause} style={{ padding: 8 }}>
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={24}
            color="#E7C11C"
          />
        </Pressable>
      </View>
    </Pressable>
  );
}
