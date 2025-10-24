import React, { useState, useEffect } from "react";
import { View, Text, Pressable, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "../context/AudioPlayerContext";

export default function NowPlayingBar() {
  const {
    currentTrack,
    isPlaying,
    togglePlayPause,
    setViewMode,
    positionMillis,
    durationMillis,
    seekTo,
  } = useAudioPlayer();

  const [sliderValue, setSliderValue] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (durationMillis > 0) {
      setSliderValue(positionMillis / durationMillis);
    }
  }, [positionMillis, durationMillis]);

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
  };

  const handleSliderComplete = (value: number) => {
    if (durationMillis > 0) {
      const newPosition = value * durationMillis;
      seekTo(newPosition);
    }
  };

  if (!currentTrack) return null;

  return (
    <Pressable
      onPress={() => {
        setViewMode("full");
      }}
      style={{
        backgroundColor: "rgba(41, 41, 41, 0.98)",
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
        bottom: 80,
        zIndex: 100,
        borderTopWidth: 1,
        borderTopColor: "rgba(231, 193, 28, 0.2)",
        borderTopRightRadius: 10,
        borderTopLeftRadius: 10,
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => {
              setIsFavorite(!isFavorite);
              console.log(
                isFavorite ? "Удалить из избранного:" : "Добавить в избранное:",
                currentTrack.title
              );
            }}
            style={{ padding: 8, marginRight: 15 }}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={24}
              color={isFavorite ? "#ff6b6b" : "#E7C11C"}
            />
          </Pressable>
          <Pressable onPress={togglePlayPause} style={{ padding: 8 }}>
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={24}
              color="#E7C11C"
            />
          </Pressable>
        </View>
      </View>

      {/* Ползунок прогресса внизу */}
      <View style={{ marginTop: 8 }}>
        <TouchableOpacity
          onPress={(event) => {
            const { locationX } = event.nativeEvent;
            const progress = locationX / 300;
            if (durationMillis > 0) {
              const newPosition = progress * durationMillis;
              seekTo(newPosition);
            }
          }}
          style={{
            height: 1,
            backgroundColor: "rgba(231, 193, 28, 0.3)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: "100%",
              width: `${sliderValue * 100}%`,
              backgroundColor: "#E7C11C",
              borderRadius: 2,
            }}
          />
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}
