import { useEffect, useState } from "react";
import { ImageSourcePropType } from "react-native";
import storage from "@react-native-firebase/storage";

import PlaceholderAvatar from "../assets/images/avatar.webp";

export const useReciterImageSource = (
  imagePath?: string,
): ImageSourcePropType => {
  const [imageSource, setImageSource] =
    useState<ImageSourcePropType>(PlaceholderAvatar);

  useEffect(() => {
    let isActive = true;

    const loadImage = async () => {
      if (!imagePath) {
        setImageSource(PlaceholderAvatar);
        return;
      }

      try {
        if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
          setImageSource({ uri: imagePath });
          return;
        }

        const downloadUrl = await storage().ref(imagePath).getDownloadURL();
        if (isActive) {
          setImageSource({ uri: downloadUrl });
        }
      } catch {
        if (isActive) {
          // Fallback to direct URI in case the path is already resolvable.
          setImageSource({ uri: imagePath });
        }
      }
    };

    loadImage();

    return () => {
      isActive = false;
    };
  }, [imagePath]);

  return imageSource;
};
