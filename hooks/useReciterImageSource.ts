import { useEffect, useState } from "react";
import { ImageSourcePropType } from "react-native";
import storage from "@react-native-firebase/storage";

import PlaceholderAvatar from "../assets/images/avatar.webp";

export interface ReciterImageSourceState {
  source: ImageSourcePropType;
  isRemote: boolean;
  isResolving: boolean;
}

export const useReciterImageSource = (
  imagePath?: string,
): ReciterImageSourceState => {
  const [state, setState] = useState<ReciterImageSourceState>({
    source: PlaceholderAvatar,
    isRemote: false,
    isResolving: false,
  });

  useEffect(() => {
    let isActive = true;

    if (!imagePath) {
      setState({ source: PlaceholderAvatar, isRemote: false, isResolving: false });
      return;
    }

    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      setState({ source: { uri: imagePath }, isRemote: true, isResolving: false });
      return;
    }

    setState({ source: PlaceholderAvatar, isRemote: true, isResolving: true });

    const loadImage = async () => {
      try {
        const downloadUrl = await storage().ref(imagePath).getDownloadURL();
        if (isActive) {
          setState({ source: { uri: downloadUrl }, isRemote: true, isResolving: false });
        }
      } catch {
        if (isActive) {
          // Fallback to direct URI in case the path is already resolvable.
          setState({ source: { uri: imagePath }, isRemote: true, isResolving: false });
        }
      }
    };

    void loadImage();

    return () => {
      isActive = false;
    };
  }, [imagePath]);

  return state;
};
