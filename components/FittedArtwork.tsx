import React from "react";
import { Image, ImageSourcePropType, View } from "react-native";

// Strong enough that the backdrop reads as colour, not as a second picture.
const BACKDROP_BLUR_RADIUS = 24;

interface FittedArtworkProps {
  source: ImageSourcePropType;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Artwork shown whole inside a square frame. Nasheed artwork is mostly
 * 16:9 or 4:3 video thumbnails, which `cover` crops; here the image is
 * contained and the letterbox bands are filled with a blurred, dimmed copy
 * of itself. Fills its parent, which owns the size, radius and clipping.
 */
export default function FittedArtwork({
  source,
  onLoad,
  onError,
}: FittedArtworkProps) {
  return (
    <View className="w-full h-full bg-qasid-black">
      <Image
        source={source}
        blurRadius={BACKDROP_BLUR_RADIUS}
        className="absolute inset-0 w-full h-full"
        resizeMode="cover"
      />
      <View className="absolute inset-0 bg-black/40" />
      <Image
        source={source}
        onLoad={onLoad}
        onError={onError}
        className="w-full h-full"
        resizeMode="contain"
      />
    </View>
  );
}
