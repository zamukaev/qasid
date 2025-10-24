import { Pressable, Text, View } from "react-native";
import { getAuth, signOut } from "@react-native-firebase/auth";
import { ScreenLayout, AudioCard } from "../../../components";
import { useAudioPlayer } from "../../../context/AudioPlayerContext";
import { Link } from "expo-router";

export default function Home() {
  const auth = getAuth();
  const { playTrack, setQueue, currentTrack, isPlaying, togglePlayPause } =
    useAudioPlayer();

  const track1 = {
    id: "calm-1",
    title: "Calm music — Zeon",
    artist: "Qasid",
    artworkUri: undefined,
    uri: require("../../../assets/Calm_music_-_Zeon_73851765.mp3"),
  };

  const track2 = {
    id: "nxily-fast",
    title: "Nxily Fast",
    artist: "Qasid",
    artworkUri: undefined,
    uri: require("../../../assets/nxily-fast.mp3"),
  };

  const handleCardPress = async (track: any) => {
    if (currentTrack?.id === track.id) {
      await togglePlayPause();
    } else {
      setQueue([track]);
      await playTrack(track);
    }
  };

  return (
    <ScreenLayout className="bg-qasid-black h-full px-4">
      <View className="pt-6 pb-3 flex-row items-center justify-between">
        <Text className="text-white text-2xl font-bold">Qasid</Text>
        <Pressable
          onPress={async () => await signOut(auth)}
          className="px-3 py-2 rounded-lg bg-white/10"
        >
          <Text className="text-gray-300 text-sm font-medium">Выйти</Text>
        </Pressable>
      </View>

      <View className="flex gap-4">
        <AudioCard
          title="Calm music — Zeon"
          artist="Qasid"
          onPress={() => handleCardPress(track1)}
          isActive={currentTrack?.id === "calm-1"}
          isPlaying={isPlaying && currentTrack?.id === "calm-1"}
          className="mt-4"
        />
        <AudioCard
          title="Nxily Fast"
          artist="Qasid"
          onPress={() => handleCardPress(track2)}
          isActive={currentTrack?.id === "nxily-fast"}
          isPlaying={isPlaying && currentTrack?.id === "nxily-fast"}
          className="mt-4"
        />
      </View>
    </ScreenLayout>
  );
}
