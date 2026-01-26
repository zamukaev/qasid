import React, { useEffect } from "react";
import { View, Text, Image, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import PlaceholderCover from "../assets/images/avatar.webp";
import { Track } from "../context/AudioPlayerContext";
import { QasidLiveEqualizer } from "./QasidLiveEqualizer";

export type QasidTrackRowProps = {
  title: string;
  subtitle?: string; // artist / reciter
  duration?: string; // "2:50"
  image?: string; // { uri } или require(...)
  track: Track;
  handlePlayTrack: (track: any) => void;
  isPlaying?: boolean;
  isPaused?: boolean;
  className?: string; // чтобы ты мог добавлять mt/mb и т.п.
};

export const SharedCard = ({
  title,
  subtitle = "",
  image,
  track,
  handlePlayTrack,
  isPlaying,
  isPaused,
  className = "",
}: QasidTrackRowProps) => {
  const onPlayPress = (event: any) => {
    event.stopPropagation();
    handlePlayTrack(track);
  };

  return (
    <Pressable
      onPress={onPlayPress}
      disabled={!handlePlayTrack}
      className={`active:opacity-90 ${className}`}
    >
      <View className="relative overflow-hidden rounded-2xl">
        <View className="absolute inset-0 bg-[#0B0B10]" />
        <LinearGradient
          colors={[
            "rgba(231,193,28,0.14)",
            "rgba(231,193,28,0.05)",
            "rgba(0,0,0,0.00)",
            "rgba(0,0,0,0.45)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.55)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View className="absolute inset-0 rounded-2xl border border-white/10" />
        <View className="flex-row items-center px-3 py-3">
          {true ? (
            <Image
              source={image ? image : PlaceholderCover}
              className="h-12 w-12 rounded-xl"
              resizeMode="cover"
            />
          ) : (
            <View className="h-12 w-12 rounded-xl bg-qasid-gray/30 items-center justify-center">
              <Text className="text-qasid-white font-semibold">
                {track.id.toString()}
              </Text>
            </View>
          )}
          <View className="ml-3 flex-1">
            <View className="flex-row items-center">
              {isPaused && (
                <QasidLiveEqualizer
                  status={isPlaying ? "playing" : "paused"}
                  className="mr-2"
                />
              )}
              <Text
                style={{ color: isPaused ? "#E7C11C" : "#DCDFE4" }}
                className="text-[16px] font-semibold text-white/90"
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>

            {!!subtitle && (
              <Text
                className="mt-0.5 text-[13px] text-white/55"
                numberOfLines={1}
              >
                {track?.artist ? track?.artist : subtitle}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
};
