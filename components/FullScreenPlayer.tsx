import React, { useEffect, useMemo, useRef } from "react";
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
        }}
      >
        <Pressable onPress={handleClose} style={{ padding: 8 }}>
          <Ionicons name="chevron-down" size={28} color="#E7C11C" />
        </Pressable>
        <Text
          style={{
            color: "#E7C11C",
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          Сейчас играет
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
              width: 280,
              height: 280,
              borderRadius: 20,
              backgroundColor: "rgba(231, 193, 28, 0.1)",
              borderWidth: 1,
              borderColor: "rgba(231, 193, 28, 0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="musical-notes" size={80} color="#E7C11C" />
          </View>
        </View>

        {/* Track Info */}
        <View style={{ alignItems: "center", marginVertical: 30 }}>
          <Text
            style={{
              color: "#E7C11C",
              fontSize: 22,
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {currentTrack?.title || "Трек"}
          </Text>
          {currentTrack?.artist && (
            <Text
              style={{
                color: "rgba(231, 193, 28, 0.7)",
                fontSize: 16,
                textAlign: "center",
              }}
            >
              {currentTrack.artist}
            </Text>
          )}
        </View>

        {/* Progress Bar */}
        <View style={{ marginBottom: 30 }}>
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
            maximumTrackTintColor="#4b4b4b"
            thumbTintColor="#E7C11C"
            style={{ height: 40, marginBottom: 10 }}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: "rgba(231, 193, 28, 0.6)", fontSize: 14 }}>
              {formatMillis(positionMillis)}
            </Text>
            <Text style={{ color: "rgba(231, 193, 28, 0.6)", fontSize: 14 }}>
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
            marginBottom: 40,
          }}
        >
          {/* Previous */}
          <Pressable onPress={prev} style={{ padding: 15, marginRight: 20 }}>
            <Ionicons name="play-skip-back" size={36} color="#E7C11C" />
          </Pressable>

          {/* Play/Pause */}
          {isPlaying ? (
            <Pressable onPress={pause} style={{ padding: 10 }}>
              <Ionicons name="pause-circle" size={70} color="#E7C11C" />
            </Pressable>
          ) : (
            <Pressable onPress={resume} style={{ padding: 10 }}>
              <Ionicons name="play-circle" size={70} color="#E7C11C" />
            </Pressable>
          )}

          {/* Next */}
          <Pressable onPress={next} style={{ padding: 15, marginLeft: 20 }}>
            <Ionicons name="play-skip-forward" size={36} color="#E7C11C" />
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
