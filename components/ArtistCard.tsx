import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View, Image, ActivityIndicator } from "react-native";

import PlaceholderAvatar from "../assets/images/avatar.webp";
import { Progressbar } from "./Progressbar";

interface Track {
  id: number;
  reciter_name?: string;
  englishName: string;
  arabicName: string;
  audioUrl: string | null;
}

interface ArtistCardProps {
  handlePlayTrack: (track: Track) => void;
  isActive: boolean;
  isPlaying: boolean;
  isPending: boolean;
  track: Track;
  hasSavedProgress: boolean;
  progressPercent: number;
  resumeMillis: number;
  style?: any;
}

export default function ArtistCard({
  handlePlayTrack,
  isActive,
  isPlaying,
  isPending,
  track,
  hasSavedProgress,
  progressPercent,
  resumeMillis,
  style,
}: ArtistCardProps) {
  const onPlayPress = (event: any) => {
    event.stopPropagation();
    handlePlayTrack(track);
  };
  return (
    <Pressable
      key={track.id}
      onPress={onPlayPress}
      disabled={isPending}
      style={style}
      className="flex-row items-center px-4 py-3 mb-3 rounded-2xl border border-qasid-gold/15 bg-qasid-gray/30 relative overflow-hidden"
    >
      {isPending && (
        <View className="absolute inset-0 bg-qasid-black/60 items-center justify-center z-10">
          <ActivityIndicator size="small" color="#E7C11C" />
        </View>
      )}
      <View className="h-10 w-10 rounded-full bg-qasid-gray/50 items-center justify-center mr-3">
        {isActive ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              handlePlayTrack(track);
            }}
            className="h-full w-full items-center justify-center"
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={20}
              color="#E7C11C"
            />
          </Pressable>
        ) : (
          <Text className="text-qasid-gold font-semibold">
            {track.id.toString()}
          </Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-qasid-white font-semibold text-base">
          {track.englishName}
        </Text>
        {track.reciter_name ? (
          <Text className="text-qasid-gold/80 text-sm">
            {track.reciter_name}
          </Text>
        ) : (
          <Text className="text-qasid-gold/80 text-sm">{track.arabicName}</Text>
        )}
        {hasSavedProgress ? (
          <Progressbar
            progressPercent={progressPercent}
            resumeMillis={resumeMillis}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
