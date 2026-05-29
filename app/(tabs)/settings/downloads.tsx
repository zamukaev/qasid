import { useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import {
  DownloadRecord,
  deleteDownload,
  getDownloads,
  getTotalDownloadSizeBytes,
} from "../../../services/download-service";
import { GOLD } from "../../../constants/colors";
import { Track, useAudioPlayer } from "../../../context/AudioPlayerContext";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function recordToTrack(record: DownloadRecord): Track {
  return {
    id: record.trackId,
    title: record.title,
    artist: record.artist,
    isNasheed: record.isNasheed,
    uri: record.localPath,
  };
}

export default function DownloadsScreen() {
  const router = useRouter();
  const { currentTrack, isPlaying, playTrack, setQueue } = useAudioPlayer();
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);

  const load = async () => {
    const map = await getDownloads();
    setDownloads(
      Object.values(map).sort((a, b) => b.downloadedAt - a.downloadedAt),
    );
    const size = await getTotalDownloadSizeBytes();
    setTotalBytes(size);
  };

  useEffect(() => {
    void load();
  }, []);

  const handlePlay = (record: DownloadRecord) => {
    const tracks = downloads.map(recordToTrack);
    setQueue(tracks);
    void playTrack(recordToTrack(record));
  };

  const handleDelete = (record: DownloadRecord) => {
    Alert.alert(
      "Remove Download",
      `Remove "${record.title}" from offline storage?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await deleteDownload(record.trackId);
            void load();
          },
        },
      ],
    );
  };

  const handleDeleteAll = () => {
    if (downloads.length === 0) return;
    Alert.alert(
      "Remove All Downloads",
      "Remove all downloaded tracks from offline storage?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove All",
          style: "destructive",
          onPress: async () => {
            await Promise.all(downloads.map((d) => deleteDownload(d.trackId)));
            void load();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView className="flex-1 px-5">
        <View className="pt-6 pb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-qasid-white text-3xl font-bold">
              Downloads
            </Text>
            <Text className="text-white/60 text-sm mt-1">
              {downloads.length} track{downloads.length !== 1 ? "s" : ""} ·{" "}
              {formatBytes(totalBytes)} used
            </Text>
          </View>
          {downloads.length > 0 && (
            <TouchableOpacity onPress={handleDeleteAll} activeOpacity={0.7}>
              <Text className="text-red-400 text-sm font-semibold">
                Remove All
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {downloads.length === 0 ? (
          <View className="flex-1 items-center justify-center mt-24">
            <Feather name="download-cloud" size={48} color="rgba(255,255,255,0.2)" />
            <Text className="text-white/40 text-base mt-4 text-center">
              No downloaded tracks yet.{"\n"}Tap the download icon on any track
              to save it for offline listening.
            </Text>
          </View>
        ) : (
          <View className="mt-2">
            {downloads.map((record) => {
              const isActive = currentTrack?.id === record.trackId;
              const isTrackPlaying = isActive && isPlaying;
              return (
                <View key={record.trackId} className="mb-2">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handlePlay(record)}
                  >
                    <View className="relative overflow-hidden rounded-2xl">
                      <View className="absolute inset-0 bg-[#0B0B10]" />
                      {isActive && (
                        <LinearGradient
                          colors={["rgba(231,193,28,0.14)", "rgba(0,0,0,0.00)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{ position: "absolute", inset: 0 }}
                        />
                      )}
                      <View
                        className="absolute inset-0 rounded-2xl border"
                        style={{
                          borderColor: isActive
                            ? "rgba(231,193,28,0.35)"
                            : "rgba(255,255,255,0.10)",
                        }}
                      />

                      <View className="flex-row items-center px-4 py-3">
                        <Feather
                          name={isTrackPlaying ? "pause-circle" : "play-circle"}
                          size={22}
                          color={isActive ? GOLD : "rgba(255,255,255,0.35)"}
                        />
                        <View className="ml-3 flex-1">
                          <Text
                            className="text-[15px] font-semibold"
                            style={{ color: isActive ? GOLD : "#ffffff" }}
                            numberOfLines={1}
                          >
                            {record.title}
                          </Text>
                          {record.artist && (
                            <Text
                              className="text-white/50 text-[13px] mt-0.5"
                              numberOfLines={1}
                            >
                              {record.artist}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDelete(record)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={{ padding: 6 }}
                        >
                          <Feather name="trash-2" size={18} color="rgba(255,100,100,0.7)" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View className="h-16" />
      </ScrollView>
    </SafeAreaView>
  );
}
