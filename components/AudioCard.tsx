import React, { useEffect, useRef } from "react";
import { Pressable, Text, View, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface AudioCardProps {
  title: string;
  artist: string;
  onPress: () => void;
  isActive?: boolean;
  isPlaying?: boolean;
  artworkUri?: string;
  className?: string;
}

export const AudioCard: React.FC<AudioCardProps> = ({
  title,
  artist,
  onPress,
  isActive = false,
  isPlaying = false,
  artworkUri,
  className = "",
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive && isPlaying) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive, isPlaying, pulseAnim]);

  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 12,
        overflow: "hidden",
        padding: 12,
        backgroundColor: isActive ? "rgba(255, 255, 255, 0.05)" : "#000000",
        borderWidth: 1,
        borderColor: isActive
          ? "rgba(255, 255, 255, 0.1)"
          : "rgba(255, 255, 255, 0.1)",
        position: "relative",
      }}
    >
      {isActive && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(128, 128, 128, 0.02)",
            zIndex: 0,
          }}
        />
      )}
      <View style={{ flexDirection: "row", alignItems: "center", zIndex: 1 }}>
        <View style={{ position: "relative" }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 8,
              backgroundColor: "#1a1a1a",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 16,
            }}
          >
            {artworkUri ? (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#4B5563",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="musical-notes" size={24} color="#ffffff" />
                </View>
                {isActive && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0, 0, 0, 0.4)",
                      borderRadius: 8,
                    }}
                  />
                )}
              </View>
            ) : (
              <>
                <Ionicons name="musical-notes" size={24} color="#ffffff" />
                {isActive && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0, 0, 0, 0.6)",
                      borderRadius: 8,
                    }}
                  />
                )}
              </>
            )}
            {isActive && (
              <Animated.View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ scale: pulseAnim }],
                  zIndex: 20,
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: "#facc15",
                    borderRadius: 10,
                  }}
                />
              </Animated.View>
            )}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 16,
              fontWeight: "500",
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={{
              color: "#9CA3AF",
              fontSize: 14,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {artist}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};
