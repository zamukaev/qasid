import { Pressable, Text, View, Image } from "react-native";
import { getAuth, signOut } from "@react-native-firebase/auth";
import { ScreenLayout } from "../../../components";
import { useAudioPlayer } from "../../../context/AudioPlayerContext";
import { Link } from "expo-router";

export default function Home() {
  const auth = getAuth();
  const { playTrack, setQueue } = useAudioPlayer();

  const startPlay = async () => {
    const track = {
      id: "calm-1",
      title: "Calm music — Zeon",
      artist: "Qasid",
      artworkUri: undefined,
      uri: require("../../../assets/Calm_music_-_Zeon_73851765.mp3"),
    };
    setQueue([track]);
    await playTrack(track);
  };

  return (
    <ScreenLayout className="bg-qasid-black h-full px-4">
      <View className="pt-6 pb-3 flex-row items-center justify-between">
        <Text className="text-qasid-gold text-2xl font-extrabold">Qasid</Text>
        <Pressable onPress={async () => await signOut(auth)}>
          <Text className="text-qasid-gold/80">Выйти</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={startPlay}
        className="mt-4 rounded-2xl bg-qasid-gold/10 border border-qasid-gold/20 overflow-hidden"
        style={{ padding: 14 }}
      >
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-lg bg-qasid-gold/20 items-center justify-center mr-3">
            <Text className="text-qasid-gold font-semibold">♪</Text>
          </View>
          <View className="flex-1">
            <Text
              className="text-qasid-gold text-base font-semibold"
              numberOfLines={1}
            >
              Calm music — Zeon
            </Text>
            <Text className="text-qasid-gold/70 text-xs" numberOfLines={1}>
              Тапните, чтобы начать воспроизведение
            </Text>
          </View>
        </View>
      </Pressable>

      <Link href="/(tabs)/player" asChild>
        <Pressable className="mt-6 items-center">
          <Text className="text-qasid-gold/70">Открыть плеер</Text>
        </Pressable>
      </Link>
    </ScreenLayout>
  );
}
