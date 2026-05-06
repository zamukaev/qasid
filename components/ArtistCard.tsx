import { Pressable, View, Image, Text } from "react-native";
import { useReciterImageSource } from "../hooks/useReciterImageSource";
import { NasheedArtist } from "../types/nasheed";

interface ArtistCardProps {
  artist: NasheedArtist;
  onPress: (id: string) => void;
}

function ArtistCard({ artist, onPress }: ArtistCardProps) {
  const imageSource = useReciterImageSource(artist.image_path);

  return (
    <Pressable
      style={{ width: "30%" }}
      onPress={() => onPress(artist.id)}
      android_ripple={{ color: "#E7C11C20" }}
      className="active:opacity-80"
    >
      <View
        className="rounded-xl overflow-hidden border border-qasid-gold/20"
        style={{
          aspectRatio: 1,
          shadowColor: "#E7C11C",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Image
          className="w-full h-full"
          source={imageSource}
          resizeMode="cover"
        />
      </View>
      <Text
        className="text-white/90 text-center text-xs font-medium mt-2"
        numberOfLines={2}
      >
        {artist.name_en}
      </Text>
    </Pressable>
  );
}

export default ArtistCard;
