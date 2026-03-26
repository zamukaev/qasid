import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAudioPlayer } from "../context/AudioPlayerContext";
import { QasidLiveEqualizer } from "./QasidLiveEqualizer";

export default function NowPlayingBar() {
  const insets = useSafeAreaInsets();
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
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    if (durationMillis > 0) {
      setSliderValue(positionMillis / durationMillis);
    } else {
      setSliderValue(0);
    }
  }, [positionMillis, durationMillis]);

  if (!currentTrack) return null;

  const handleSeekBarLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  const handleSeekPress = async (locationX: number) => {
    if (durationMillis <= 0 || barWidth <= 0) return;
    const progress = Math.max(0, Math.min(1, locationX / barWidth));
    const newPosition = progress * durationMillis;
    await seekTo(newPosition);
  };

  return (
    <View
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: insets.bottom + 45,
        zIndex: 100,
        borderRadius: 24,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(231, 193, 28, 0.14)",
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      }}
    >
      <LinearGradient
        colors={["rgba(20, 20, 22, 0.90)", "rgba(11, 11, 12, 0.94)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 14, paddingVertical: 12 }}
      >
        <Pressable
          onPress={() => {
            setViewMode("full");
          }}
          style={({ pressed }) => ({
            opacity: pressed ? 0.96 : 1,
            transform: [{ scale: pressed ? 0.995 : 1 }],
          })}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "rgba(231, 193, 28, 0.14)",
                  backgroundColor: "rgba(231, 193, 28, 0.08)",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  marginBottom: 10,
                }}
              >
                <QasidLiveEqualizer
                  status={isPlaying ? "playing" : "paused"}
                  minHeight={5}
                  maxHeight={12}
                  barWidth={3}
                  gap={3}
                  className="mr-1"
                />
                <Text
                  style={{
                    color: "#E7C11C",
                    fontSize: 10,
                    fontWeight: "700",
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                  }}
                >
                  Now Playing
                </Text>
              </View>

              <Text
                numberOfLines={1}
                style={{
                  color: "#F5F5F2",
                  fontSize: 15,
                  fontWeight: "700",
                  letterSpacing: 0.2,
                }}
              >
                {currentTrack.title}
              </Text>
              {currentTrack.artist ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: "rgba(255, 255, 255, 0.64)",
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {currentTrack.artist}
                </Text>
              ) : null}
            </View>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Pressable
                onPress={async (event) => {
                  event.stopPropagation();
                  await togglePlayPause();
                }}
                style={({ pressed }) => ({
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(231, 193, 28, 0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(231, 193, 28, 0.18)",
                  opacity: pressed ? 0.86 : 1,
                })}
              >
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={22}
                  color="#E7C11C"
                  style={{ marginLeft: isPlaying ? 0 : 2 }}
                />
              </Pressable>

              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.10)",
                }}
              >
                <Ionicons name="chevron-up" size={18} color="#F5F5F2" />
              </View>
            </View>
          </View>

          <View
            onLayout={handleSeekBarLayout}
            style={{ marginTop: 12, width: "100%" }}
          >
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                void handleSeekPress(event.nativeEvent.locationX);
              }}
              style={{
                height: 4,
                  backgroundColor: "rgba(231, 193, 28, 0.14)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${sliderValue * 100}%`,
                  backgroundColor: "#E7C11C",
                  borderRadius: 999,
                }}
              />
            </Pressable>
          </View>
        </Pressable>
      </LinearGradient>
    </View>
  );
}
