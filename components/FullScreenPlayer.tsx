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
  } = useAudioPlayer();

  const [isFavorite, setIsFavorite] = useState(false);

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
          <Ionicons name="chevron-down" size={28} color="#ffffff" />
        </Pressable>
        <Text
          style={{
            color: "#ffffff",
            fontSize: 16,
            fontWeight: "500",
          }}
        >
          Сейчас играет
        </Text>
        <Pressable
          onPress={() => {
            setIsFavorite(!isFavorite);
            console.log(
              isFavorite ? "Удалить из избранного:" : "Добавить в избранное:",
              currentTrack?.title
            );
          }}
          style={{ padding: 8 }}
        >
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={28}
            color={isFavorite ? "#ff6b6b" : "#ffffff"}
          />
        </Pressable>
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
              backgroundColor: "#1a1a1a",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="musical-notes" size={100} color="#ffffff" />
          </View>
        </View>

        {/* Track Info */}
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 24,
              fontWeight: "600",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {currentTrack?.title || "Трек"}
          </Text>
          {currentTrack?.artist && (
            <Text
              style={{
                color: "#9CA3AF",
                fontSize: 16,
                textAlign: "center",
              }}
            >
              {currentTrack.artist}
            </Text>
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
            minimumTrackTintColor="#ffffff"
            maximumTrackTintColor="#4b4b4b"
            thumbTintColor="#ffffff"
            style={{ height: 40, marginBottom: 10 }}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: "#9CA3AF", fontSize: 14 }}>
              {formatMillis(positionMillis)}
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 14 }}>
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
          <Pressable onPress={prev} style={{ padding: 15, marginRight: 20 }}>
            <Ionicons name="play-skip-back" size={32} color="#ffffff" />
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
