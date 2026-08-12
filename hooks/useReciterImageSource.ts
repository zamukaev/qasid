import { useEffect, useState } from "react";
import { ImageSourcePropType } from "react-native";

import PlaceholderAvatar from "../assets/images/avatar.webp";
import { peekStorageUrl, resolveStorageUrl } from "../services/storage";

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

    // Already-resolved paths skip the resolving state entirely, so a revisited
    // screen renders its artwork on the first frame instead of shimmering.
    const cached = peekStorageUrl(imagePath);
    if (cached) {
      setState({ source: { uri: cached }, isRemote: true, isResolving: false });
      return;
    }

    setState({ source: PlaceholderAvatar, isRemote: true, isResolving: true });

    const loadImage = async () => {
      // resolveStorageUrl already falls back to the raw path on failure, in
      // case the path turns out to be directly resolvable.
      const downloadUrl = await resolveStorageUrl(imagePath);
      if (isActive) {
        setState({
          source: { uri: downloadUrl },
          isRemote: true,
          isResolving: false,
        });
      }
    };

    void loadImage();

    return () => {
      isActive = false;
    };
  }, [imagePath]);

  return state;
};
