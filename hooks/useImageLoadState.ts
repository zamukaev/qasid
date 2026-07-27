import { useEffect, useState } from "react";
import { ImageSourcePropType } from "react-native";
import { useReciterImageSource } from "./useReciterImageSource";

export interface ImageLoadState {
  source: ImageSourcePropType;
  showSkeleton: boolean;
  onLoad: () => void;
  onError: () => void;
}

export const useImageLoadState = (imagePath?: string): ImageLoadState => {
  const { source, isRemote, isResolving } = useReciterImageSource(imagePath);
  const [hasLoaded, setHasLoaded] = useState(false);

  // A new imagePath means a new (or recycled) card — stale "loaded" state must
  // not suppress the skeleton for whatever image is about to load next.
  useEffect(() => {
    setHasLoaded(false);
  }, [imagePath]);

  return {
    source,
    showSkeleton: isResolving || (isRemote && !hasLoaded),
    onLoad: () => setHasLoaded(true),
    onError: () => setHasLoaded(true),
  };
};
