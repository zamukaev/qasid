import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  Dimensions,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useAudioPlayer } from "../context/AudioPlayerContext";

export default function FullScreenPlayer() {
  const {
    currentTrack,
    isPlaying,
    positionMillis,
    durationMillis,
    pause,
    resume,
    seekTo,
    setViewMode,
    next,
    prev,
    togglePlayPause,
  } = useAudioPlayer();

  const progress = useMemo(() => {
    if (!durationMillis) return 0;
    return positionMillis / durationMillis;
  }, [positionMillis, durationMillis]);

  const handleClose = () => {
    Animated.timing(translateY, {
      toValue: screenHeight,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setViewMode("mini"));
  };

  const screenHeight = Dimensions.get("window").height;
  const translateY = useRef(new Animated.Value(screenHeight)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldClose =
          gesture.dy > screenHeight * 0.18 || gesture.vy > 0.8;
        if (shouldClose) {
          Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 180,
            useNativeDriver: true,
          }).start(() => handleClose());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#090A07",
        zIndex: 1000,
        elevation: 1000,
        transform: [{ translateY }],
      }}
      {...panResponder.panHandlers}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 50,
          paddingBottom: 20,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <Pressable onPress={handleClose} style={{ padding: 8 }}>
          <Ionicons name="chevron-down" size={28} color="#ffffff" />
        </Pressable>
        <Text
          style={{
            color: "#ffffff",
            fontSize: 16,
            fontWeight: "700",
            letterSpacing: 0.5,
          }}
        >
          Now Playing
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Main Content */}
      <View
        style={{
          flex: 1,
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingBottom: 20,
        }}
      >
        {/* Album Art */}
        <View style={{ alignItems: "center", marginTop: 20 }}>
          <View
            style={{
              width: 300,
              height: 300,
              borderRadius: 12,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderWidth: 2,
              borderColor: "rgba(255, 255, 255, 0.15)",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 15,
              elevation: 10,
            }}
          >
            <View
              style={{
                width: 280,
                height: 280,
                borderRadius: 8,
                backgroundColor: "rgba(20, 20, 22, 0.8)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="musical-notes" size={100} color="#E7C11C" />
            </View>
          </View>
        </View>

        {/* Track Info */}
        <View style={{ alignItems: "center" }}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 26,
                fontWeight: "700",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              {currentTrack?.title || "Track"}
            </Text>
            {currentTrack?.artist && (
              <View
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                }}
              >
                <Text
                  style={{
                    color: "rgba(255, 255, 255, 0.8)",
                    fontSize: 16,
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                >
                  {currentTrack.artist}
                </Text>
              </View>
            )}
        </View>

        {/* Progress Bar */}
        <View style={{ marginBottom: 20 }}>
          <Slider
            value={progress}
            onSlidingComplete={(ratio) => {
              const target =
                Math.max(
                  0,
                  Math.min(1, Array.isArray(ratio) ? ratio[0] : ratio)
                ) * (durationMillis || 0);
              seekTo(target);
            }}
            minimumTrackTintColor="#E7C11C"
            maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
            thumbTintColor="#ffffff"
            style={{ height: 40, marginBottom: 10 }}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: 14, fontWeight: "500" }}>
              {formatMillis(positionMillis)}
            </Text>
            <Text style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: 14, fontWeight: "500" }}>
              {formatMillis(durationMillis)}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 80,
          }}
        >
          {/* Previous */}
          <Pressable 
            onPress={prev} 
            style={{ 
              padding: 15, 
              marginRight: 20,
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: 30,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.2)",
            }}
          >
            <Ionicons name="play-skip-back" size={32} color="#ffffff" />
          </Pressable>

          {/* Play/Pause */}
          <Pressable 
            onPress={togglePlayPause} 
            style={{ 
              padding: 10,
              shadowColor: "#E7C11C",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 15,
              elevation: 8,
            }}
          >
            <Ionicons
              name={isPlaying ? "pause-circle" : "play-circle"}
              size={70}
              color="#E7C11C"
            />
          </Pressable>

          {/* Next */}
          <Pressable 
            onPress={next} 
            style={{ 
              padding: 15, 
              marginLeft: 20,
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: 30,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.2)",
            }}
          >
            <Ionicons name="play-skip-forward" size={32} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function formatMillis(ms?: number) {
  const total = Math.floor((ms || 0) / 1000);
  const m = Math.floor(total / 60).toString();
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
